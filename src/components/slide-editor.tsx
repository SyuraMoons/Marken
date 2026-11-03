"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import type { Slide } from "@/lib/posts/slides";
import { CANVAS_H, CANVAS_W, FONTS, clampBox, fitFontSize, isFontId, type Box, type SlideLayers, type TextLayer } from "@/lib/studio/layers";
import { Button } from "./button";
import { glassInput } from "./field";
import { InfoCard } from "./info-card";
import { StatusScreen } from "./status-screen";

type Busy = null | "save" | "rewrite" | "background";
type Note = null | "saved" | "checkFailed" | "limit" | "rewriteRules" | "error";

const range = "h-11 w-full accent-blue";
const label = "flex flex-col gap-2 text-sm font-medium";

// Slide editor (SRD A-09): layers per slide. Words, fonts, colours and product placement are redrawn by code in about a
// second; "reword" and "new background" ask a model. The product pixels come from the confirmed cutout, never a model.
export function SlideEditor({ postId, slides, onClose }: { postId: string; slides: Slide[]; onClose: () => void }) {
  const [order, setOrder] = useState(slides[0]?.order ?? 1);
  // Lives here, not in the panel: the panel remounts when the saved slide comes back, and the result must stay visible.
  const [note, setNote] = useState<Note>(null);
  const slide = slides.find((s) => s.order === order) ?? slides[0];
  if (!slide) return null;

  return (
    <StatusScreen title={t("se.title")} body={t("se.body")}>
      <div role="tablist" aria-label={t("se.title")} className="grid grid-cols-3 gap-2">
        {slides.map((s) => (
          <button
            key={s.order}
            type="button"
            role="tab"
            aria-selected={s.order === order}
            onClick={() => { setOrder(s.order); setNote(null); }}
            className={`relative aspect-[4/5] overflow-hidden rounded-control border-2 focus-visible:outline-2 focus-visible:outline-blue ${s.order === order ? "border-blue" : "border-transparent opacity-70"}`}
          >
            <Image src={s.slide_path} alt={t("se.slide", { n: s.order })} fill sizes="120px" className="object-cover" />
          </button>
        ))}
      </div>
      {/* Remount when the server returns the re-rendered slide, so the draft resets to what was saved. */}
      <SlidePanel key={slide.slide_path} postId={postId} slide={slide} note={note} setNote={setNote} />
      <Button variant="text" onClick={onClose}>
        {t("se.done")}
      </Button>
    </StatusScreen>
  );
}

function SlidePanel({ postId, slide, note, setNote }: { postId: string; slide: Slide; note: Note; setNote: (n: Note) => void }) {
  const router = useRouter();
  const saved = slide.layers;
  const [layers, setLayers] = useState<SlideLayers | null>(saved ?? null);
  const [base] = useState<Box | null>(saved ? saved.product.box : null);
  const [busy, setBusy] = useState<Busy>(null);
  const [instruction, setInstruction] = useState("");
  const [bgPrompt, setBgPrompt] = useState("");
  const [target, setTarget] = useState(0);

  const preview = (
    <figure className="relative mx-auto aspect-[4/5] w-full max-w-90 overflow-hidden rounded-card bg-white">
      <Image src={slide.slide_path} alt={slide.alt} fill sizes="(min-width: 1024px) 360px, 90vw" className="object-cover" />
    </figure>
  );

  if (!layers || !base) {
    return (
      <>
        {preview}
        <InfoCard vector="details" title={t("se.slide", { n: slide.order })}>
          {t("se.legacy")}
        </InfoCard>
      </>
    );
  }

  const setText = (i: number, patch: Partial<TextLayer>) => setLayers({ ...layers, text: layers.text.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  // Product: size is a percentage of the original fit area, position is where it sits between the slide edges.
  const box = layers.product.box;
  const sizePct = Math.round((box.width / base.width) * 100);
  const freeX = CANVAS_W - box.width;
  const freeY = CANVAS_H - box.height;
  const moveProduct = (next: { size?: number; x?: number; y?: number }) => {
    const size = next.size ?? sizePct;
    const width = Math.round((base.width * size) / 100);
    const height = Math.round((base.height * size) / 100);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const placed = clampBox(
      {
        x: next.x !== undefined ? ((CANVAS_W - width) * next.x) / 100 : cx - width / 2,
        y: next.y !== undefined ? ((CANVAS_H - height) * next.y) / 100 : cy - height / 2,
        width,
        height,
      },
      120,
    );
    setLayers({ ...layers, product: { box: placed } });
  };

  const call = async (kind: Exclude<Busy, null>, url: string, body: unknown) => {
    setBusy(kind);
    setNote(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (res?.status === 401) return router.push("/login");
    if (res?.status === 429) {
      setBusy(null);
      return setNote("limit");
    }
    if (!res?.ok) {
      setBusy(null);
      return setNote("error");
    }
    const data = (await res.json().catch(() => ({}))) as { slide?: { fidelity_passed?: boolean }; text?: string; rulesPassed?: boolean };
    if (kind === "rewrite") {
      if (data.text && layers.text[target]) setText(target, { text: data.text, size: fitFontSize(data.text, layers.text[target].font, layers.text[target].box) });
      setBusy(null);
      return setNote(data.rulesPassed === false ? "rewriteRules" : null);
    }
    // Saved: the page re-reads, this panel remounts with the new slide, and the result note stays visible.
    setNote(data.slide?.fidelity_passed === false ? "checkFailed" : "saved");
    router.refresh();
    setBusy(null);
  };

  const locked = busy !== null;
  return (
    <>
      <div className="relative" aria-busy={locked}>
        {preview}
        {locked && (
          <p role="status" className="absolute inset-x-3 bottom-3 rounded-control bg-white/90 p-3 text-center text-sm font-medium">
            {t(busy === "background" ? "se.bgBusy" : busy === "save" ? "se.running" : "se.rewriting")}
          </p>
        )}
      </div>

      {layers.text.map((l, i) => (
        <section key={l.id} className="glass flex flex-col gap-4 rounded-card p-5 leading-[1.4]">
          <h2 className="text-lg font-semibold">{t(`se.role.${l.role}` as MessageKey)}</h2>
          <label className={label}>
            {t("se.text")}
            <input value={l.text} maxLength={120} onChange={(e) => setText(i, { text: e.target.value, size: fitFontSize(e.target.value, l.font, l.box) })} className={`${glassInput} font-normal`} />
          </label>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <label className={label}>
              {t("se.font")}
              <select value={l.font} onChange={(e) => isFontId(e.target.value) && setText(i, { font: e.target.value, size: fitFontSize(l.text, e.target.value, l.box) })} className={glassInput}>
                {Object.entries(FONTS).map(([id, f]) => (
                  <option key={id} value={id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              <span className="sr-only">{t("se.color")}</span>
              <input type="color" value={l.color} aria-label={t("se.color")} onChange={(e) => setText(i, { color: e.target.value })} className="size-13 cursor-pointer rounded-control border border-border bg-white p-1" />
            </label>
          </div>
          <label className={label}>
            {t("se.size")}
            <input type="range" min={24} max={200} value={l.size} onChange={(e) => setText(i, { size: Number(e.target.value) })} className={range} />
          </label>
        </section>
      ))}

      <section className="glass flex flex-col gap-4 rounded-card p-5 leading-[1.4]">
        <h2 className="text-lg font-semibold">{t("se.rewriteLabel")}</h2>
        {layers.text.length > 1 && (
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label={t("se.text")} className={glassInput}>
            {layers.text.map((l, i) => (
              <option key={l.id} value={i}>
                {t(`se.role.${l.role}` as MessageKey)}
              </option>
            ))}
          </select>
        )}
        <input value={instruction} maxLength={300} onChange={(e) => setInstruction(e.target.value)} placeholder={t("se.rewritePlaceholder")} className={glassInput} />
        <Button
          variant="secondary"
          disabled={locked || !instruction.trim() || !layers.text[target]}
          onClick={() => call("rewrite", `/api/posts/${postId}/slides/${slide.order}/rewrite`, { instruction: instruction.trim(), current: layers.text[target]?.text ?? "" })}
        >
          {t("se.rewrite")}
        </Button>
      </section>

      <section className="glass flex flex-col gap-4 rounded-card p-5 leading-[1.4]">
        <h2 className="text-lg font-semibold">{t("se.product")}</h2>
        <label className={label}>
          {t("se.productSize")}
          <input type="range" min={40} max={160} value={sizePct} onChange={(e) => moveProduct({ size: Number(e.target.value) })} className={range} />
        </label>
        <label className={label}>
          {t("se.productLeftRight")}
          <input type="range" min={0} max={100} value={freeX > 0 ? Math.round((box.x / freeX) * 100) : 50} onChange={(e) => moveProduct({ x: Number(e.target.value) })} className={range} />
        </label>
        <label className={label}>
          {t("se.productUpDown")}
          <input type="range" min={0} max={100} value={freeY > 0 ? Math.round((box.y / freeY) * 100) : 50} onChange={(e) => moveProduct({ y: Number(e.target.value) })} className={range} />
        </label>
      </section>

      <section className="glass flex flex-col gap-4 rounded-card p-5 leading-[1.4]">
        <h2 className="text-lg font-semibold">{t("se.bgLabel")}</h2>
        <input value={bgPrompt} maxLength={300} onChange={(e) => setBgPrompt(e.target.value)} placeholder={t("se.bgPlaceholder")} className={glassInput} />
        <p className="text-sm text-muted">{t("se.bgNote")}</p>
        <Button variant="secondary" disabled={locked} onClick={() => call("background", `/api/posts/${postId}/slides/${slide.order}/background`, { prompt: bgPrompt.trim() || undefined })}>
          {t("se.bg")}
        </Button>
      </section>

      <div aria-live="polite" className="flex flex-col gap-2">
        {note === "saved" && <p className="text-sm text-muted">{t("se.saved")}</p>}
        {note === "rewriteRules" && <p role="alert" className="text-sm text-danger">{t("se.rewriteRules")}</p>}
        {note === "checkFailed" && <p role="alert" className="text-sm text-danger">{t("se.checkFailed")}</p>}
        {note === "limit" && <p role="alert" className="text-sm text-danger">{t("se.limit")}</p>}
        {note === "error" && <p role="alert" className="text-sm text-danger">{t("common.error")}</p>}
      </div>
      <Button disabled={locked} aria-busy={busy === "save"} onClick={() => call("save", `/api/posts/${postId}/slides/${slide.order}`, { layers })}>
        {t("se.run")}
      </Button>
    </>
  );
}

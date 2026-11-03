"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBrandKit } from "@/lib/actions/brand-kit";
import { BRIEF_GOALS, hasBrandKit, type BrandDirection, type BrandKitValue, type BriefGoal, type DraftedBrief } from "@/lib/brand-kit";
import { t, type MessageKey } from "@/lib/i18n";
import { FONTS, isFontId, type FontId } from "@/lib/studio/layers";
import { BrandKitEditor } from "./brand-kit-editor";
import { Button, ButtonLink } from "./button";
import { glassInput } from "./field";
import { Photo } from "./products-view";

type Product = { id: string; name: string; cutoutUrl: string | null };
type Step = "brief" | "kit" | "review";
type Choice = { kind: "direction"; index: number } | { kind: "saved" } | { kind: "manual" };

type BriefFields = Pick<DraftedBrief, "audience" | "mood" | "highlight">;

const STEPS: Step[] = ["brief", "kit", "review"];
const FIELDS = [
  { key: "audience", max: 160, rows: 2 },
  { key: "mood", max: 100, rows: 1 },
  { key: "highlight", max: 200, rows: 3 },
] as const;
const EMPTY_BRIEF: BriefFields = { audience: "", mood: "", highlight: "" };

const sentence = (label: string, s: string) => (s.trim() ? `${label}: ${s.trim().replace(/[.\s]+$/, "")}.` : "");

async function requestBrief(shopId: string, productId: string, goal?: BriefGoal, signal?: AbortSignal) {
  const res = await fetch(`/api/shops/${shopId}/brand-kit/brief`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId, goal }),
    signal,
  }).catch(() => null);
  return res?.ok ? ((await res.json().catch(() => null)) as DraftedBrief | null) : null;
}

const fontLabel = (f: FontId | null) => (f ? FONTS[f].label : t("bk.fontDefault"));
const asKit = (d: BrandDirection): BrandKitValue => ({
  colors: d.colors,
  heading_font: isFontId(d.heading_font) ? d.heading_font : null,
  body_font: isFontId(d.body_font) ? d.body_font : null,
  design_guidance: d.design_guidance,
  photo_style: d.photo_style,
});
const same = (a: BrandKitValue, b: BrandKitValue) => JSON.stringify(a) === JSON.stringify(b);

// Create flow (FD-46): nothing generates until the owner has written a brief, chosen a brand kit and pressed Generate.
export function CreateFlow({ shopId, product, savedKit, hasDescription }: { shopId: string; product: Product; savedKit: BrandKitValue; hasDescription: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("brief");
  const [goal, setGoal] = useState<BriefGoal | null>(null);
  const [brief, setBrief] = useState<BriefFields>(EMPTY_BRIEF);
  // The brief is drafted only when the owner presses Generate brief; nothing calls the model on arrival.
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const [directions, setDirections] = useState<BrandDirection[] | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);
  const hasSaved = hasBrandKit(savedKit);
  const [choice, setChoice] = useState<Choice>(hasSaved ? { kind: "saved" } : { kind: "manual" });
  const [manual, setManual] = useState<BrandKitValue>(savedKit);
  const [pending, start] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);

  const fullBrief = [
    goal ? t(`create.goal.${goal}.brief` as MessageKey) : "",
    ...FIELDS.map((f) => sentence(t(`create.brief.${f.key}.short` as MessageKey), brief[f.key])),
  ]
    .filter(Boolean)
    .join(" ");
  const kit: BrandKitValue =
    choice.kind === "direction" && directions?.[choice.index] ? asKit(directions[choice.index]) : choice.kind === "saved" ? savedKit : manual;

  const applyBrief = (d: DraftedBrief | null) => {
    setWriting(false);
    if (!d) return setWriteFailed(true);
    setWritten(true);
    setGoal(d.goal);
    setBrief({ audience: d.audience, mood: d.mood, highlight: d.highlight });
  };

  const writeBrief = async () => {
    setWriting(true);
    setWriteFailed(false);
    applyBrief(await requestBrief(shopId, product.id, goal ?? undefined));
  };

  const draft = async () => {
    setStep("kit");
    setDrafting(true);
    setDraftFailed(false);
    const res = await fetch(`/api/shops/${shopId}/brand-kit/directions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief: fullBrief, productId: product.id }),
    }).catch(() => null);
    const body = res?.ok ? ((await res.json().catch(() => null)) as { directions?: BrandDirection[] } | null) : null;
    setDrafting(false);
    if (!body?.directions?.length) return setDraftFailed(true);
    setDirections(body.directions);
    setChoice({ kind: "direction", index: 0 });
  };

  const generate = () =>
    start(async () => {
      setError(null);
      if (!same(kit, savedKit)) {
        const saved = await saveBrandKit(kit).catch(() => ({ ok: false }));
        if (!saved.ok) return setError("bk.saveError");
      }
      const res = await fetch(`/api/shops/${shopId}/posts/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id, brief: fullBrief || undefined }),
      }).catch(() => null);
      if (res?.ok) return router.push("/today");
      const code = res ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error : null;
      setError(code === "daily_post_limit" ? "products.err.limit" : code === "queue_unavailable" ? "products.err.queue" : "common.error");
    });

  const n = STEPS.indexOf(step) + 1;

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <header className="bg-signature flex flex-col gap-4 rounded-[18px] border border-white/85 px-4 py-5 leading-[1.4] lg:rounded-card lg:px-6">
        <div className="flex items-center gap-4">
          {product.cutoutUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={product.cutoutUrl} alt="" width={56} height={56} className="size-14 shrink-0 rounded-control bg-white object-contain p-1" />
          )}
          <div className="flex min-w-0 flex-col">
            <p className="text-[11px] font-semibold text-blue uppercase">{t("create.eyebrow")}</p>
            <h1 className="truncate text-2xl font-semibold lg:text-3xl">{product.name}</h1>
          </div>
        </div>
        <ol aria-label={t("create.progress", { n, total: STEPS.length })} className="grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={s === step ? "step" : undefined} className="flex flex-col gap-1.5">
              <span className={`h-1.5 rounded-full ${i < n ? "bg-blue" : "bg-white"}`} />
              <span className={`text-xs ${s === step ? "font-semibold text-ink" : "text-muted"}`}>{t(`create.step.${s}` as MessageKey)}</span>
            </li>
          ))}
        </ol>
      </header>

      {step === "brief" && (
        <section className="flex max-w-2xl flex-col gap-5 leading-[1.4]">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[26px] font-semibold">{t("create.brief.title")}</h2>
            <p className="text-muted">{t("create.brief.body")}</p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t("create.brief.goal")}</legend>
            <div className="flex flex-wrap gap-2">
              {BRIEF_GOALS.map((g) => (
                <label key={g} className={`flex h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-blue ${goal === g ? "border-blue bg-powder text-blue" : "border-border bg-white text-slate"}`}>
                  <input type="radio" name="goal" value={g} checked={goal === g} onChange={() => setGoal(g)} className="sr-only" />
                  {t(`create.goal.${g}` as MessageKey)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="glass flex flex-col gap-4 rounded-card p-5" aria-busy={writing}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-blue" role="status">
                {writing
                  ? t("create.brief.writing")
                  : writeFailed
                    ? t("create.brief.writeError")
                    : written
                      ? t("create.brief.written")
                      : t("create.brief.idle")}
              </p>
              <Button variant="secondary" className="w-auto! px-4" onClick={writeBrief} disabled={writing}>
                {t(writeFailed ? "create.brief.writeRetry" : written ? "create.brief.rewrite" : "create.brief.generate")}
              </Button>
            </div>
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm font-medium">
                {t(`create.brief.${f.key}` as MessageKey)}
                {writing ? (
                  <span className="h-12 animate-pulse rounded-control bg-powder" />
                ) : (
                  <textarea
                    value={brief[f.key]}
                    onChange={(e) => setBrief((b) => ({ ...b, [f.key]: e.target.value }))}
                    rows={f.rows}
                    maxLength={f.max}
                    placeholder={t(`create.brief.${f.key}.placeholder` as MessageKey)}
                    className={`${glassInput} font-normal`}
                  />
                )}
              </label>
            ))}
          </div>
          <p className="text-sm text-muted">{t("create.brief.hint")}</p>
          <Button onClick={draft} disabled={writing || !fullBrief}>
            {t("create.brief.next")}
          </Button>
          <ButtonLink href="/products" variant="text">
            {t("create.cancel")}
          </ButtonLink>
        </section>
      )}

      {step === "kit" && (
        <section className="flex flex-col gap-5 leading-[1.4]">
          <div className="flex max-w-2xl flex-col gap-1.5">
            <h2 className="text-[26px] font-semibold">{t("create.kit.title")}</h2>
            <p className="text-muted">{t("create.kit.body")}</p>
          </div>

          <div role="radiogroup" aria-label={t("create.kit.title")} aria-busy={drafting} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drafting &&
              [0, 1, 2].map((i) => (
                <div key={i} className="glass flex h-56 flex-col gap-3 rounded-card p-5">
                  <span className="h-5 w-32 animate-pulse rounded bg-powder" />
                  <span className="flex gap-2">
                    {[0, 1, 2, 3].map((j) => <span key={j} className="size-9 animate-pulse rounded-full bg-powder" />)}
                  </span>
                  <span className="h-4 w-full animate-pulse rounded bg-powder" />
                  <span className="h-4 w-2/3 animate-pulse rounded bg-powder" />
                </div>
              ))}
            {directions?.map((d, i) => (
              <KitCard
                key={i}
                title={d.name}
                summary={d.summary}
                kit={asKit(d)}
                badge={t("create.kit.aiBadge")}
                selected={choice.kind === "direction" && choice.index === i}
                onSelect={() => setChoice({ kind: "direction", index: i })}
              />
            ))}
            {hasSaved && (
              <KitCard title={t("create.kit.saved")} summary={t("create.kit.savedBody")} kit={savedKit} selected={choice.kind === "saved"} onSelect={() => setChoice({ kind: "saved" })} />
            )}
            <button
              type="button"
              role="radio"
              aria-checked={choice.kind === "manual"}
              onClick={() => setChoice({ kind: "manual" })}
              className={`flex min-h-40 flex-col items-start justify-center gap-2 rounded-card border-2 border-dashed p-5 text-left focus-visible:outline-2 focus-visible:outline-blue ${choice.kind === "manual" ? "border-blue bg-powder/50" : "border-border bg-white/60"}`}
            >
              <span className="text-lg font-semibold">{t("create.kit.manual")}</span>
              <span className="text-[15px] text-muted">{t("create.kit.manualBody")}</span>
            </button>
          </div>

          {draftFailed && (
            <div role="alert" className="flex flex-col gap-2 text-sm text-danger">
              <p>{t("create.kit.error")}</p>
              <Button variant="secondary" className="max-w-60" onClick={draft}>
                {t("create.kit.retry")}
              </Button>
            </div>
          )}

          {choice.kind === "manual" && (
            <div className="glass max-w-2xl rounded-card p-5">
              <BrandKitEditor shopId={shopId} value={manual} onChange={setManual} hasDescription={hasDescription} />
            </div>
          )}

          <div className="flex max-w-2xl flex-col gap-2">
            <Button onClick={() => setStep("review")} disabled={drafting}>
              {t("create.kit.next")}
            </Button>
            {!drafting && directions && (
              <Button variant="secondary" onClick={draft}>
                {t("create.kit.again")}
              </Button>
            )}
            <Button variant="text" onClick={() => setStep("brief")}>
              {t("create.back")}
            </Button>
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="flex flex-col gap-5 leading-[1.4]">
          <div className="flex max-w-2xl flex-col gap-1.5">
            <h2 className="text-[26px] font-semibold">{t("create.review.title")}</h2>
            <p className="text-muted">{t("create.review.body")}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_1fr]">
            <Photo src={product.cutoutUrl} alt={product.name} eyebrow={t("studio.productEyebrow")} caption={t("studio.productPicked")} />
            <div className="flex flex-col gap-4">
              <section className="glass flex flex-col gap-2 rounded-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-blue uppercase">{t("create.step.brief")}</h3>
                  <Button variant="text" className="w-auto! px-0" onClick={() => setStep("brief")}>{t("create.change")}</Button>
                </div>
                <p className="text-[15px] whitespace-pre-line">{fullBrief}</p>
              </section>
              <section className="glass flex flex-col gap-3 rounded-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-blue uppercase">{t("create.step.kit")}</h3>
                  <Button variant="text" className="w-auto! px-0" onClick={() => setStep("kit")}>{t("create.change")}</Button>
                </div>
                <KitDetails kit={kit} />
                {!same(kit, savedKit) && <p className="text-sm text-muted">{t("create.review.kitSaved")}</p>}
              </section>
              <section className="glass flex flex-col gap-1.5 rounded-card p-5">
                <h3 className="text-sm font-semibold text-blue uppercase">{t("create.review.output")}</h3>
                <p className="text-[15px] text-muted">{t("create.review.outputBody")}</p>
              </section>
            </div>
          </div>
          <div className="flex max-w-2xl flex-col gap-2" aria-live="polite">
            {error && (
              <p role="alert" className="text-sm text-danger">
                {t(error)}
              </p>
            )}
            <Button onClick={generate} disabled={pending} aria-busy={pending}>
              {t(pending ? "products.starting" : "products.makePost")}
            </Button>
            <Button variant="text" onClick={() => setStep("kit")} disabled={pending}>
              {t("create.back")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  if (!colors.length) return <span className="text-sm text-muted">{t("create.kit.noColors")}</span>;
  return (
    <span className="flex gap-1.5">
      {colors.map((c, i) => (
        <span key={i} title={c} className="size-9 rounded-full border border-black/10 shadow-sm" style={{ background: c }} />
      ))}
    </span>
  );
}

function KitDetails({ kit }: { kit: BrandKitValue }) {
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <Swatches colors={kit.colors} />
      <p>
        <span className="text-muted">{t("create.kit.type")} </span>
        {fontLabel(kit.heading_font)} / {fontLabel(kit.body_font)}
      </p>
      {kit.design_guidance && <p className="text-muted">{kit.design_guidance}</p>}
      {kit.photo_style && <p className="text-sm text-muted">{kit.photo_style}</p>}
    </div>
  );
}

function KitCard({ title, summary, kit, badge, selected, onSelect }: { title: string; summary: string; kit: BrandKitValue; badge?: string; selected: boolean; onSelect: () => void }) {
  const main = kit.colors[0] ?? "#2456db";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`glass flex flex-col gap-3 overflow-hidden rounded-card p-0 text-left transition focus-visible:outline-2 focus-visible:outline-blue ${selected ? "ring-2 ring-blue" : "hover:ring-1 hover:ring-border"}`}
    >
      <span className="flex h-20 items-end p-4" style={{ background: `linear-gradient(135deg, ${main}, ${kit.colors[1] ?? main})` }}>
        <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink">{selected ? `✓ ${t("create.kit.selected")}` : badge ?? title}</span>
      </span>
      <span className="flex flex-col gap-3 px-5 pb-5">
        <span className="flex flex-col gap-1">
          <span className="text-lg font-semibold">{title}</span>
          <span className="text-sm text-muted">{summary}</span>
        </span>
        <KitDetails kit={kit} />
      </span>
    </button>
  );
}

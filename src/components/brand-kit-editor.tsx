"use client";

import { useState } from "react";
import { MAX_COLORS, type BrandKitValue } from "@/lib/brand-kit";
import { t } from "@/lib/i18n";
import { FONTS, isFontId, type FontId } from "@/lib/studio/layers";
import { Button } from "./button";
import { Field, glassInput } from "./field";

// Brand kit editor (SRD A-09). Controlled: the parent owns the value and decides when to save, so onboarding
// step 4 saves it with Continue and Settings has its own Save button.
export function BrandKitEditor({ shopId, value, onChange, hasDescription }: { shopId: string; value: BrandKitValue; onChange: (v: BrandKitValue) => void; hasDescription: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "filled" | "failed">("idle");
  const set = (patch: Partial<BrandKitValue>) => onChange({ ...value, ...patch });

  const autofill = async () => {
    setState("busy");
    const res = await fetch(`/api/shops/${shopId}/brand-kit/suggest`, { method: "POST" }).catch(() => null);
    const body = res?.ok ? ((await res.json().catch(() => null)) as { kit?: BrandKitValue } | null) : null;
    if (!body?.kit) return setState("failed");
    onChange({ ...body.kit, heading_font: isFontId(body.kit.heading_font) ? body.kit.heading_font : null, body_font: isFontId(body.kit.body_font) ? body.kit.body_font : null });
    setState("filled");
  };

  const fontSelect = (current: FontId | null, change: (f: FontId | null) => void) => (
    <select value={current ?? ""} onChange={(e) => change(isFontId(e.target.value) ? e.target.value : null)} className={glassInput}>
      <option value="">{t("bk.fontDefault")}</option>
      {Object.entries(FONTS).map(([id, f]) => (
        <option key={id} value={id}>
          {f.label}
        </option>
      ))}
    </select>
  );

  return (
    <section data-tour="brand-kit" aria-label={t("bk.title")} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 leading-[1.4]">
        <h2 className="text-lg font-semibold">{t("bk.title")}</h2>
        <p className="text-[15px] text-muted">{t("bk.body")}</p>
      </div>

      <div className="flex flex-col gap-2" aria-live="polite">
        <Button variant="secondary" onClick={autofill} disabled={!hasDescription || state === "busy"} aria-busy={state === "busy"}>
          {t(state === "busy" ? "bk.autofilling" : "bk.autofill")}
        </Button>
        {!hasDescription && <p className="text-sm text-muted">{t("bk.needDescription")}</p>}
        {state === "filled" && <p className="text-sm text-muted">{t("bk.filled")}</p>}
        {state === "failed" && (
          <p role="alert" className="text-sm text-danger">
            {t("bk.error")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm leading-[1.4] font-medium">{t("bk.colors")}</span>
        <ul className="flex flex-wrap gap-3">
          {value.colors.map((c, i) => (
            <li key={i} className="flex items-center gap-1">
              <input
                type="color"
                value={c}
                aria-label={t("bk.colorN", { n: i + 1 })}
                onChange={(e) => set({ colors: value.colors.map((x, j) => (j === i ? e.target.value : x)) })}
                className="size-11 cursor-pointer rounded-control border border-border bg-white p-1"
              />
              <button type="button" aria-label={t("bk.removeColor", { n: i + 1 })} onClick={() => set({ colors: value.colors.filter((_, j) => j !== i) })} className="flex size-11 items-center justify-center text-xl text-danger">
                ×
              </button>
            </li>
          ))}
          {value.colors.length < MAX_COLORS && (
            <li>
              <Button variant="secondary" className="h-11! w-auto!" onClick={() => set({ colors: [...value.colors, "#2456db"] })}>
                + {t("bk.addColor")}
              </Button>
            </li>
          )}
        </ul>
        <p className="text-xs text-muted">{t("bk.colorsHint")}</p>
      </div>

      <Field n={1} cue="text" label={t("bk.headingFont")}>
        {fontSelect(value.heading_font, (f) => set({ heading_font: f }))}
      </Field>
      <Field n={2} cue="text" label={t("bk.bodyFont")}>
        {fontSelect(value.body_font, (f) => set({ body_font: f }))}
      </Field>
      <Field n={3} cue="voice" label={t("bk.guidance")}>
        <textarea value={value.design_guidance} onChange={(e) => set({ design_guidance: e.target.value })} rows={3} maxLength={1000} placeholder={t("bk.guidancePlaceholder")} className={glassInput} />
      </Field>
      <Field n={4} cue="product" label={t("bk.photo")}>
        <textarea value={value.photo_style} onChange={(e) => set({ photo_style: e.target.value })} rows={2} maxLength={500} placeholder={t("bk.photoPlaceholder")} className={glassInput} />
      </Field>
    </section>
  );
}

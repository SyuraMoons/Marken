"use client";

import { useState } from "react";
import { Button, ButtonLink } from "./button";
import { Carousel } from "./carousel";
import { Logo } from "./logo";
import { AppHelp } from "./app-help";
import { t } from "@/lib/i18n";
import type { Slide } from "@/lib/posts/slides";

const slides: Slide[] = [1, 2, 3].map((order) => ({ order, text: "", alt: "Sample serum product", scene_path: "", slide_path: "/mock/sample-product.png", fidelity_score: 0, fidelity_passed: false }));

// This isolated practice flow has no API calls, uploads, storage writes or publishing actions.
export function SandboxView() {
  const [stage, setStage] = useState<"product" | "review" | "share" | "complete" | "error">("product");
  const [caption, setCaption] = useState(0);
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const reset = () => { setStage("product"); setCaption(0); setPlatform("instagram"); };
  return <div className="bg-app min-h-dvh">
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6"><Logo href="/sandbox" /><ButtonLink prefetch={false} href="/today" variant="text" className="w-auto!">{t("practice.exit")}</ButtonLink></header>
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 pb-28" data-practice-state={stage}>
      <section className="rounded-card border border-powder bg-white p-6" data-tour="practice-intro">
        <p className="text-xs font-bold uppercase text-blue">{t("practice.badge")}</p>
        <h1 className="mt-2 text-3xl font-semibold">{t("practice.title")}</h1>
        <p className="mt-3 text-muted">{t("practice.safety")}</p>
      </section>
      <nav aria-label={t("practice.progress")} className="flex flex-wrap gap-3 text-sm font-semibold text-navy">
        {(["product", "review", "share", "complete"] as const).map((item, index) => <span key={item} aria-current={stage === item ? "step" : undefined} className={`rounded-control px-4 py-3 ${stage === item ? "bg-powder" : "bg-white"}`}>{index + 1}. {t(`practice.${item}`)}</span>)}
      </nav>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <section className="rounded-card bg-white p-6" data-tour="practice-product">
          <Carousel slides={slides} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} eyebrow={t("practice.productName")} />
          <p className="mt-4 text-sm text-muted">{t("practice.photoNote")}</p>
        </section>
        <section className="flex flex-col gap-5 rounded-card bg-white p-6" data-tour="practice-actions" aria-live="polite">
          {stage === "product" && <>
            <h2 className="text-xl font-semibold">{t("practice.fixedTitle")}</h2>
            <label className="flex flex-col gap-2 text-sm font-semibold">{t("practice.productLabel")}<input readOnly value={t("practice.productName")} className="rounded-control border border-border bg-surface p-3" /></label>
            <label className="flex flex-col gap-2 text-sm font-semibold">{t("practice.briefLabel")}<textarea readOnly value={t("practice.brief")} rows={3} className="rounded-control border border-border bg-surface p-3" /></label>
            <Button onClick={() => setStage("review")}>{t("practice.generate")}</Button>
            <Button variant="text" onClick={() => setStage("error")}>{t("practice.tryError")}</Button>
          </>}
          {stage === "error" && <>
            <h2 className="text-xl font-semibold">{t("practice.errorTitle")}</h2><p>{t("practice.errorBody")}</p>
            <Button onClick={() => setStage("review")}>{t("practice.retry")}</Button>
          </>}
          {stage === "review" && <>
            <h2 className="text-xl font-semibold">{t("practice.reviewTitle")}</h2><p className="text-sm text-muted">{t("practice.reviewBody")}</p>
            <fieldset className="flex flex-col gap-3"><legend className="mb-3 font-semibold">{t("today.caption")}</legend>
              {[0, 1].map((index) => <label key={index} className={`flex cursor-pointer gap-3 rounded-control border p-4 ${caption === index ? "border-blue bg-powder/40" : "border-border"}`}><input type="radio" name="practice-caption" checked={caption === index} onChange={() => setCaption(index)} /><span>{t(index === 0 ? "practice.caption0" : "practice.caption1")}</span></label>)}
            </fieldset>
            <Button onClick={() => setStage("share")}>{t("practice.chooseDestination")}</Button><Button variant="text" onClick={() => setStage("product")}>{t("practice.back")}</Button>
          </>}
          {stage === "share" && <>
            <h2 className="text-xl font-semibold">{t("practice.shareTitle")}</h2><p className="text-sm text-muted">{t("practice.shareBody")}</p>
            <fieldset className="flex flex-col gap-3"><legend className="mb-3 font-semibold">{t("share.to")}</legend>
              {(["instagram", "facebook"] as const).map((item) => <label key={item} className="flex min-h-12 items-center gap-3 rounded-control border border-border p-3"><input type="radio" name="practice-platform" checked={platform === item} onChange={() => setPlatform(item)} />{t(`share.${item}`)}</label>)}
            </fieldset><blockquote className="rounded-control bg-surface p-4">{t(caption === 0 ? "practice.caption0" : "practice.caption1")}</blockquote>
            <Button onClick={() => setStage("complete")}>{t("practice.approve")}</Button><Button variant="text" onClick={() => setStage("review")}>{t("practice.back")}</Button>
          </>}
          {stage === "complete" && <>
            <h2 className="text-xl font-semibold">{t("practice.completeTitle")}</h2><p>{t("practice.completeBody")}</p>
            <p className="rounded-control bg-powder p-4">{t("practice.destination", { platform: t(`share.${platform}`) })}</p>
            <Button onClick={reset}>{t("practice.reset")}</Button><ButtonLink prefetch={false} href="/today" variant="secondary">{t("practice.exit")}</ButtonLink>
          </>}
        </section>
      </div>
      <Button variant="text" onClick={reset} className="w-auto! self-start">{t("practice.reset")}</Button>
    </main>
    <AppHelp scope="sandbox" />
  </div>;
}

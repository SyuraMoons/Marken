"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { DemoScene } from "./demo-scene";

const subscribe = (callback: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  window.addEventListener("marken-motion", callback);
  return () => {
    query.removeEventListener("change", callback);
    window.removeEventListener("marken-motion", callback);
  };
};
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";

function DemoCopy({ texts, step, className = "" }: { texts: string[]; step: number; className?: string }) {
  return <span className={`demo-copy grid ${className}`}>
    {texts.map((text, index) => <span key={index} aria-hidden={index !== step} data-active={index === step} className="col-start-1 row-start-1">{text}</span>)}
  </span>;
}

// Sample walkthroughs never call upload, generation or publishing endpoints.
export function FeatureDemo({ feature }: { feature: number }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);
  const still = useSyncExternalStore(subscribe, reduced, () => true);
  const root = useRef<HTMLDivElement>(null);
  const playing = visible && !paused && !held && !still;
  const key = (part: string) => t(`demo.${feature}.${part}` as MessageKey);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setStep((current) => (current + 1) % 3);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <div ref={root} data-feature-demo={feature} data-step={step} data-playing={playing} data-still={still} className="feature-demo relative isolate w-full overflow-hidden rounded-card border border-border bg-white text-ink shadow-xl shadow-navy/10"
      onFocus={() => setHeld(true)} onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setHeld(false)}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
        <span className="text-sm font-semibold">{t(`landing.f${feature}Demo` as MessageKey)}</span>
        <span className="rounded-full bg-powder/60 px-2.5 py-1 text-xs font-semibold text-navy">{t("demo.sample")}</span>
      </div>
      <div className="demo-stage relative flex min-h-72 flex-col justify-center gap-5 bg-signature p-5 sm:min-h-88 sm:p-8">
        <DemoScene feature={feature} />
        <div aria-live={playing ? "off" : "polite"} className="flex min-h-14 items-center gap-3 rounded-control border border-white bg-white/90 px-4 py-3 shadow-sm">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-powder text-xs font-bold text-navy">{step + 1}</span>
          <DemoCopy texts={[0, 1, 2].map((index) => key(`step${index}`))} step={step} className="text-sm leading-5" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
        <div className="flex gap-1" aria-label={t("demo.steps")}>
          {[0, 1, 2].map((index) => <button key={index} type="button" aria-label={key(`step${index}`)} aria-pressed={step === index} onClick={() => { setStep(index); setPaused(true); }} className="flex size-11 items-center justify-center rounded-control focus-visible:outline-2 focus-visible:outline-blue"><span className={`h-1.5 rounded-full transition-all ${step === index ? "w-7 bg-blue" : "w-3 bg-border"}`} /></button>)}
        </div>
        <button type="button" onClick={() => { setHeld(false); setPaused((value) => !value); }} disabled={still} className="min-h-11 rounded-control px-3 text-xs font-semibold text-link focus-visible:outline-2 focus-visible:outline-blue disabled:text-muted">{t(still ? "demo.still" : paused ? "demo.play" : "demo.pause")}</button>
      </div>
    </div>
  );
}

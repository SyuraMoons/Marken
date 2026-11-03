"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "./button";
import { prefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { t, type MessageKey } from "@/lib/i18n";

type Step = { selector: string; body: MessageKey };
const pages: Record<string, Step[]> = {
  today: [{ selector: 'main h1', body: 'tour.today' }, { selector: '[data-tour="carousel"] button', body: 'tour.carousel' }, { selector: '[data-tour="caption"]', body: 'tour.caption' }, { selector: '[data-tour="approve"]', body: 'tour.approve' }],
  products: [{ selector: 'main h1', body: 'tour.products' }, { selector: '[data-tour="add-product"]', body: 'tour.addProduct' }, { selector: 'main figure', body: 'tour.productPhoto' }],
  results: [{ selector: 'main h1', body: 'tour.results' }, { selector: 'main section', body: 'tour.resultsData' }],
  settings: [{ selector: 'main h1', body: 'tour.settings' }, { selector: '[data-tour="settings-1"]', body: 'tour.company' }, { selector: '[data-tour="settings-2"]', body: 'tour.voice' }, { selector: '[data-tour="settings-3"]', body: 'tour.social' }, { selector: '[data-tour="settings-6"]', body: 'tour.account' }],
  activity: [{ selector: 'main h1', body: 'tour.activity' }, { selector: 'main details', body: 'tour.activityDetails' }],
  onboarding: [{ selector: 'main h1, h1', body: 'tour.onboarding' }, { selector: 'main input, main button', body: 'tour.onboardingInput' }],
  sandbox: [{ selector: '[data-tour="practice-intro"]', body: 'tour.practice' }, { selector: '[data-tour="practice-product"] button', body: 'tour.practiceProduct' }, { selector: '[data-tour="practice-actions"] button', body: 'tour.practiceActions' }],
};

function visibleTarget(selector: string) {
  return [...document.querySelectorAll<HTMLElement>(selector)].find((element) => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
}

function RoutedHelp() {
  const path = usePathname();
  const view = useSearchParams().get("view");
  const scope = path === "/today" && (view === "activity" || view === "details") ? "activity" : path.startsWith("/posts") ? "today" : path.split("/")[1];
  return <Help key={`${path}?${view}`} scope={scope} />;
}

export function AppHelp({ scope }: { scope?: string }) {
  return scope ? <Help scope={scope} /> : <Suspense fallback={null}><RoutedHelp /></Suspense>;
}

function Help({ scope }: { scope: string }) {
  const [mode, setMode] = useState<"closed" | "menu" | "tour">("closed");
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  // `step` ties a measurement to the step it was taken for, so a stale spotlight is never shown under another step's text.
  const [rect, setRect] = useState({ step: "", left: 0, top: 0, width: 0, height: 0 });
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = steps[index];
  const close = () => { setMode("closed"); trigger.current?.focus(); };

  useEffect(() => {
    const element = dialog.current;
    if (mode === "closed") { element?.close(); return; }
    if (!element?.open) element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mode]);

  useEffect(() => {
    if (mode !== "tour" || !active) return;
    const target = visibleTarget(active.selector);
    if (!target) return; // No spotlight is drawn for it: `rect.step` no longer matches the active step.
    const box = target.getBoundingClientRect();
    window.scrollBy({ top: box.top - window.innerHeight * .2, behavior: prefersReducedMotion() ? "instant" : "smooth" });
    const measure = () => {
      const bounds = target.getBoundingClientRect();
      const top = Math.max(4, bounds.top - 6);
      const room = (card.current?.getBoundingClientRect().top ?? innerHeight) - top - 20;
      setRect({ step: active.selector, left: Math.max(4, bounds.left - 6), top, width: Math.min(bounds.width + 12, innerWidth - 8), height: Math.min(bounds.height + 12, Math.max(48, room), innerHeight * .5) });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(target);
    window.addEventListener("scroll", measure, true); window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [active, mode]);

  const start = () => {
    const configured = pages[scope] ?? [{ selector: "main h1", body: "tour.today" as MessageKey }];
    const candidates: Step[] = [...configured, { selector: '[data-tour="navigation"]', body: 'tour.navigation' }];
    const available = candidates.filter((step) => visibleTarget(step.selector));
    setSteps(available); setIndex(0);
    if (available.length) setMode("tour");
  };

  return <>
    <button ref={trigger} type="button" aria-label={t("tour.help")} onClick={() => setMode("menu")} className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex size-12 items-center justify-center rounded-full border border-white bg-navy text-xl font-bold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">?</button>
    <dialog ref={dialog} onCancel={close} onClose={() => { setMode("closed"); trigger.current?.focus(); }} aria-labelledby="help-title" className="tour-dialog" onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter((element) => element.getClientRects().length);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      {mode === "tour" && rect.width > 0 && rect.step === active?.selector && <div aria-hidden="true" className="tour-spotlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}><span className="tour-pointer">↖</span></div>}
      <section ref={card} className="tour-card flex flex-col gap-4 rounded-card border border-powder bg-white p-5 text-ink shadow-2xl">
        <div className="flex items-center justify-between gap-4"><h2 id="help-title" className="text-xl font-semibold">{t(mode === "tour" ? "tour.title" : "tour.help")}</h2><button type="button" onClick={close} className="flex size-11 shrink-0 items-center justify-center rounded-control text-xl focus-visible:outline-2 focus-visible:outline-blue" aria-label={t("tour.close")}>×</button></div>
        {mode === "menu" && <><p className="text-sm text-muted">{t("tour.menuBody")}</p><Button onClick={start}>{t("tour.start")}</Button><Link href="/sandbox" onClick={close} className="flex min-h-13 items-center justify-center rounded-control border border-border bg-surface px-4 text-center font-medium">{t("tour.practiceLink")}</Link></>}
        {mode === "tour" && active && <><p className="text-xs font-semibold text-blue">{t("tour.counter", { current: index + 1, total: steps.length })}</p><p aria-live="polite" className="leading-relaxed">{t(active.body)}</p><div className="flex gap-3"><Button variant="secondary" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>{t("practice.back")}</Button><Button onClick={() => index + 1 === steps.length ? close() : setIndex((value) => value + 1)}>{t(index + 1 === steps.length ? "tour.finish" : "tour.next")}</Button></div><button type="button" onClick={close} className="min-h-11 text-sm text-link">{t("tour.skip")}</button></>}
      </section>
    </dialog>
  </>;
}

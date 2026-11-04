"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ButtonLink } from "./button";
import { glassInput } from "./field";
import { InfoCard } from "./info-card";
import { PageHeader } from "./page-header";
import { StatusScreen } from "./status-screen";
import { t } from "@/lib/i18n";

type View = "list" | "detail" | "learning";

// Results (Figma page 03, F-17 / F-18 P1). No metrics or orders backend exists yet, so every number is "—": results are never invented.
export function ResultsView() {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [refreshing, start] = useTransition();
  const [orders, setOrders] = useState("");
  const [triedSave, setTriedSave] = useState(false);
  const back = (
    <Button variant="text" onClick={() => setView("list")}>
      {t("results.back")}
    </Button>
  );

  // Refreshing post results (270:1105): existing results stay; no placeholder numbers.
  if (refreshing) {
    return (
      <StatusScreen title={t("results.loadingTitle")} body={t("results.loadingBody")}>
        <section aria-busy="true" aria-live="polite" className="glass flex flex-col gap-3 rounded-card p-5 leading-[1.4]">
          <div className="flex flex-col gap-2.5" aria-hidden="true">
            <span className="h-11 animate-pulse rounded-control bg-border" />
            <span className="h-3 animate-pulse rounded-full bg-border" />
            <span className="h-3 w-2/3 animate-pulse rounded-full bg-border" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
          <img src="/figma/vector-build.svg" width={78} height={50} alt="" />
          <h2 className="text-lg font-semibold">{t("results.loadingCard")}</h2>
          <p className="text-[15px] text-muted">{t("results.loadingCardBody")}</p>
        </section>
        <InfoCard vector="check" title={t("loading.waitTitle")}>
          {t("results.loadingWait")}
        </InfoCard>
      </StatusScreen>
    );
  }

  // Post performance (228:14588).
  if (view === "detail") {
    return (
      <StatusScreen title={t("results.detailTitle")} body={t("results.detailBody")}>
        <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
          <InfoCard vector="score" title={t("results.perfTitle")}>
            {t("results.perfReach")}
            <br />
            <span className="whitespace-pre-wrap">{t("results.perfEngagement")}</span>
            <br />
            {t("results.perfAwaiting")}
          </InfoCard>
          <section className="flex flex-col gap-4 leading-[1.4]">
            <label className="flex flex-col gap-4 text-sm font-medium">
              {t("results.ordersLabel")}
              <input value={orders} onChange={(e) => setOrders(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={t("results.ordersPlaceholder")} className={glassInput} />
            </label>
            <p className="text-[13px] text-muted">{t("results.ordersNote")}</p>
            {/* shortcut: no orders table yet (F-17 P1), so saving only explains that nothing was stored. */}
            {triedSave && (
              <p role="status" className="text-sm text-muted">
                {t("results.ordersUnavailable")}
              </p>
            )}
            <Button onClick={() => setTriedSave(true)} disabled={!orders}>
              {t("results.saveOrders")}
            </Button>
            <Button variant="secondary" onClick={() => setView("learning")}>
              {t("results.weekly")}
            </Button>
            {back}
          </section>
        </div>
      </StatusScreen>
    );
  }

  // Weekly insights (228:14709).
  if (view === "learning") {
    return (
      <StatusScreen title={t("results.learnTitle")} body={t("results.learnBody")}>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <InfoCard vector="clock" title={t("results.historyTitle")}>
            {t("results.historyBody")}
          </InfoCard>
          <div className="flex flex-col gap-4">
            <InfoCard vector="details" title={t("results.memoryTitle")}>
              {t("results.memoryBody")}
            </InfoCard>
            <Button variant="secondary" onClick={() => setView("list")}>
              {t("results.back")}
            </Button>
          </div>
        </div>
      </StatusScreen>
    );
  }

  // Post results, styled after the landing page "05 / Results" demo (demo-scene.tsx feature 5):
  // a results window with three metric tiles, plus a floating "↗" card that opens post performance.
  const metrics = [
    ["results.reach", "results.reachNote"],
    ["results.saves", "results.savesNote"],
    ["results.orders", "results.ordersNoteShort"],
  ] as const;
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader eyebrow={t("results.eyebrow")} title={t("results.title")} body={t("results.body")} />
      <section className="overflow-hidden rounded-card border border-border bg-white leading-[1.4] shadow-[0_24px_48px_rgb(33_61_140/0.13)]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 lg:px-6">
          <h2 className="text-[15px] font-semibold">{t("nav.results")}</h2>
          <button
            type="button"
            onClick={() => start(() => router.refresh())}
            className="flex min-h-11 items-center text-sm font-medium text-muted hover:text-navy hover:underline focus-visible:outline-2 focus-visible:outline-blue"
          >
            {t("results.refresh")}
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3 lg:gap-4 lg:p-6">
          {metrics.map(([label, note]) => (
            <div key={label} className="flex flex-col gap-1.5 rounded-control bg-surface p-4 lg:p-5">
              <span className="text-sm text-muted">{t(label)}</span>
              {/* No metrics backend yet: always "—", never an invented number. */}
              <b className="text-3xl font-semibold text-ink">—</b>
              <span className="text-[13px] text-muted">{t(note)}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 border-t border-border px-5 py-4 lg:px-6">
          <p className="text-[15px] font-semibold">{t("results.emptyTitle")}</p>
          <p className="text-sm text-muted">{t("results.emptyBody")}</p>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <button
          type="button"
          onClick={() => setView("detail")}
          className="flex items-center gap-4 rounded-card bg-white p-4 text-left shadow-[0_18px_30px_rgb(33_61_140/0.15)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-blue lg:max-w-md"
        >
          <span aria-hidden="true" className="text-3xl text-blue">↗</span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{t("results.viewPost")}</span>
            <span className="text-[13px] text-muted">{t("results.detailBody")}</span>
          </span>
        </button>
        <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
          <Button variant="secondary" onClick={() => setView("learning")}>
            {t("results.weekly")}
          </Button>
          <ButtonLink href="/today" variant="text">
            {t("results.backToday")}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

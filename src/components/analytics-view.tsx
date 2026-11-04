"use client";

import Image from "next/image";
import { useState } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { ANALYTICS_DAYS, DEMO_ANALYTICS, summarizeAnalytics } from "@/lib/mock/analytics";
import { PageHeader } from "./page-header";
import { Button } from "./button";
import { glassInput } from "./field";

const number = (value: number) => value.toLocaleString("en-US");
const date = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(value + "T12:00:00Z"));

export function AnalyticsView() {
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [platform, setPlatform] = useState("all");
  const [selected, setSelected] = useState("all");
  const available = DEMO_ANALYTICS.filter(post => platform === "all" || post.platform === platform);
  const posts = available.filter(post => selected === "all" || post.id === selected);
  const summary = summarizeAnalytics(posts);
  const maximum = Math.max(...summary.dailyReach, 1);
  const metrics: { key: MessageKey; value: number; note: MessageKey }[] = [
    { key: "analytics.reach", value: summary.reach, note: "analytics.reachNote" },
    { key: "analytics.interactions", value: summary.interactions, note: "analytics.interactionsNote" },
    { key: "analytics.saves", value: summary.saves, note: "analytics.savesNote" },
    { key: "analytics.orders", value: summary.orders, note: "analytics.ordersNote" },
  ];
  const breakdown: [MessageKey, number][] = [["analytics.likes", summary.likes], ["analytics.comments", summary.comments], ["analytics.shares", summary.shares], ["analytics.saves", summary.saves]];
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader eyebrow={t("analytics.eyebrow")} title={t("nav.results")} body={t("analytics.body")} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("analytics.source")} className="flex gap-1 rounded-control border border-border bg-white p-1">
          {(["demo", "live"] as const).map(value => <Button key={value} variant={mode === value ? "primary" : "text"} aria-pressed={mode === value} onClick={() => setMode(value)} className="h-11! w-auto! text-sm!">{t(value === "demo" ? "analytics.demo" : "analytics.live")}</Button>)}
        </div>
        <p className="text-sm text-muted">{t("analytics.period")}</p>
      </div>
      {mode === "live" ? <section className="glass flex flex-col gap-3 rounded-card p-6">
        <h2 className="text-xl font-semibold">{t("analytics.liveTitle")}</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted">{t("analytics.liveBody")}</p>
        <Button variant="secondary" className="w-auto! self-start" onClick={() => setMode("demo")}>{t("analytics.viewDemo")}</Button>
      </section> : <>
        <aside className="flex flex-col gap-1 rounded-card border border-border bg-powder/40 px-5 py-4">
          <p className="text-sm font-semibold text-navy">{t("analytics.demoNotice")}</p>
          <p className="text-sm leading-5 text-muted">{t("analytics.demoExplanation")}</p>
        </aside>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">{t("analytics.platform")}
            <select aria-label={t("analytics.platform")} className={glassInput} value={platform} onChange={event => { setPlatform(event.target.value); setSelected("all"); }}>
              <option value="all">{t("analytics.allPlatforms")}</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">{t("analytics.post")}
            <select aria-label={t("analytics.post")} className={glassInput} value={selected} onChange={event => setSelected(event.target.value)}>
              <option value="all">{t("analytics.allPosts")}</option>{available.map(post => <option key={post.id} value={post.id}>{t(post.title)}</option>)}
            </select>
          </label>
        </div>
        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-live="polite">
          {metrics.map(metric => <div key={metric.key} className="flex flex-col gap-2 rounded-card border border-border bg-white p-4 lg:p-5">
            <dt className="text-sm text-muted">{t(metric.key)}</dt><dd className="text-3xl font-semibold tracking-tight text-ink">{number(metric.value)}</dd><dd className="text-xs leading-5 text-muted">{t(metric.note)}</dd>
          </div>)}
        </dl>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section data-tour="results" className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-white p-5 lg:p-6">
            <div><h2 className="text-lg font-semibold">{t("analytics.chartTitle")}</h2><p className="mt-1 text-xs leading-5 text-muted">{t("analytics.chartNote")}</p></div>
            <svg role="img" aria-label={t("analytics.chartLabel")} viewBox="0 0 560 190" className="h-auto w-full">
              <title>{t("analytics.chartTitle")}</title><desc>{ANALYTICS_DAYS.map((day, i) => `${date(day)}: ${summary.dailyReach[i]}`).join("; ")}</desc>
              {[0, 1, 2].map(i => <line key={i} x1="10" x2="550" y1={30 + i * 55} y2={30 + i * 55} className="stroke-border" />)}
              {summary.dailyReach.map((value, i) => <g key={ANALYTICS_DAYS[i]}>
                <rect x={22 + i * 76} y={145 - value / maximum * 110} width="42" height={value / maximum * 110} rx="5" className="fill-blue" opacity={value === maximum ? 1 : 0.45} />
                <text x={43 + i * 76} y={Math.max(18, 135 - value / maximum * 110)} textAnchor="middle" fontSize="20" className="fill-ink sm:text-[11px]">{number(value)}</text>
                <text x={43 + i * 76} y="170" textAnchor="middle" fontSize="20" className="fill-muted sm:text-[11px]">{date(ANALYTICS_DAYS[i])}</text>
              </g>)}
            </svg>
            <details className="text-xs text-link"><summary className="cursor-pointer py-2">{t("analytics.chartTable")}</summary><table className="w-full text-left"><thead><tr><th className="py-2">{t("analytics.date")}</th><th>{t("analytics.reach")}</th></tr></thead><tbody>{ANALYTICS_DAYS.map((day, i) => <tr key={day}><td className="py-1">{date(day)}</td><td>{number(summary.dailyReach[i])}</td></tr>)}</tbody></table></details>
          </section>
          <section className="flex flex-col gap-4 rounded-card border border-border bg-white p-5 lg:p-6">
            <h2 className="text-lg font-semibold">{t("analytics.breakdown")}</h2>
            {breakdown.map(([label, value]) => <div key={label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm"><span className="text-muted">{t(label)}</span><b>{number(value)}</b></div>
              <svg aria-hidden="true" viewBox="0 0 100 4" className="h-2 w-full" preserveAspectRatio="none"><rect width="100" height="4" rx="2" className="fill-surface" /><rect width={summary.interactions ? value / summary.interactions * 100 : 0} height="4" rx="2" className="fill-blue" /></svg>
            </div>)}
            <p className="border-t border-border pt-3 text-xs leading-5 text-muted">{t("analytics.impressions", { n: number(summary.impressions) })}</p>
          </section>
        </div>
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{t("analytics.postsTitle")}</h2>
          {posts.map(post => <article key={post.id} className="grid gap-4 rounded-card border border-border bg-white p-5 lg:grid-cols-[88px_minmax(0,1fr)_auto] lg:p-6">
            <div className="relative hidden aspect-[4/5] overflow-hidden rounded-control bg-surface lg:block"><Image src="/mock/sample-product.png" alt={t("analytics.productAlt")} fill sizes="88px" className="object-contain" /></div>
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-xs font-medium text-link">{post.platform === "instagram" ? "Instagram" : "Facebook"} · {date(post.date)} · {t("analytics.sample")}</p>
              <h3 className="text-base font-semibold">{t(post.title)}</h3>
              <p className="text-sm leading-5 text-muted">{t(post.context)}</p>
              <p className="text-sm leading-5 text-ink">{t(post.insight)}</p>
            </div>
            <div className="flex flex-col gap-3 lg:min-w-40">
              <p className="text-sm text-muted">{t("analytics.postSummary", { reach: number(post.reach), saves: post.saves, orders: post.orders })}</p>
              <Button variant="secondary" className="h-11! text-sm!" onClick={() => setSelected(selected === post.id ? "all" : post.id)}>{t(selected === post.id ? "analytics.reset" : "analytics.focus")}</Button>
            </div>
          </article>)}
        </section>
      </>}
    </div>
  );
}


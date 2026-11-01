"use client";

import { useState } from "react";
import { Button } from "./button";
import { Carousel } from "./carousel";
import { t, type MessageKey } from "@/lib/i18n";
import { mockLearning, mockPost, mockResults, type PostResult } from "@/lib/mock";
import { asSlides } from "@/lib/posts/slides";

const METRICS = ["reach", "likes", "shares", "saves"] as const;

// Results (F-17, FR-RS-01): 24-hour metrics per published post, orders entered by the owner.
export function ResultsView() {
  const [rows, setRows] = useState(mockResults);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [learning, setLearning] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const sum = (k: (typeof METRICS)[number] | "orders") => rows.reduce((n, r) => n + r[k], 0);
  const detail = rows.find((r) => r.postId === detailId);

  const ordersField = (r: PostResult) => (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {t("results.ordersLabel")}
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={r.orders}
        onChange={(e) => setRows(rows.map((x) => (x.postId === r.postId ? { ...x, orders: Math.max(0, Number(e.target.value) || 0) } : x)))}
        className="h-13 w-full rounded-control border border-border bg-white px-4 text-base font-normal placeholder:text-muted focus:outline-2 focus:outline-blue"
      />
    </label>
  );

  const metrics = (r: PostResult) => (
    <dl className="grid grid-cols-4 gap-3">
      {METRICS.map((k) => (
        <div key={k} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">{t(`results.${k}` as MessageKey)}</dt>
          <dd className="font-medium">{r[k].toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );

  if (learning) {
    return (
      <section className="flex max-w-xl flex-col gap-5">
        <Button variant="text" className="w-auto! self-start px-0" onClick={() => setLearning(false)}>
          ← {t("results.back")}
        </Button>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t("results.learn")}</h1>
          <p className="text-muted">{t("results.learnBody")}</p>
        </header>
        {mockLearning.map((l) => (
          <article key={l.id} className="flex flex-col gap-3 rounded-card border border-border bg-white p-5">
            <h2 className="font-semibold">{l.title}</h2>
            <p className="text-sm text-muted">{l.evidence}</p>
            <Button
              variant={added.includes(l.id) ? "secondary" : "primary"}
              aria-pressed={added.includes(l.id)}
              onClick={() => setAdded(added.includes(l.id) ? added.filter((x) => x !== l.id) : [...added, l.id])}
            >
              {added.includes(l.id) ? `✓ ${t("results.learnAdded")}` : t("results.learnAdd")}
            </Button>
          </article>
        ))}
      </section>
    );
  }

  if (detail) {
    const slides = asSlides(mockPost.slides);
    const captions = (mockPost.caption_options as string[]) ?? [];
    return (
      <section className="flex max-w-xl flex-col gap-5">
        <Button variant="text" className="w-auto! self-start px-0" onClick={() => setDetailId(null)}>
          ← {t("results.back")}
        </Button>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{detail.product}</h1>
          <p className="text-muted">{t("results.detailBody", { date: detail.date })}</p>
        </header>
        <Carousel slides={slides} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} />
        <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
          <h2 className="text-xl font-semibold">{t("results.metricsTitle")}</h2>
          {metrics(detail)}
          {ordersField(detail)}
        </div>
        <div className="flex flex-col gap-2 rounded-card border border-border bg-white p-5">
          <h2 className="text-xl font-semibold">{t("results.caption")}</h2>
          <p className="text-muted">{mockPost.chosen_caption ?? captions[0]}</p>
          <p className="text-sm text-muted">{mockPost.hashtags.join(" ")}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 pt-2">
        <h1 className="text-4xl font-semibold tracking-tight">{t("results.title")}</h1>
        <p className="text-muted">{t("results.body")}</p>
      </header>

      <section aria-label={t("results.summary")} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[...METRICS, "orders" as const].map((k) => (
          <div key={k} className="flex flex-col gap-1 rounded-card border border-border bg-white p-4">
            <p className="text-2xl font-semibold">{sum(k).toLocaleString()}</p>
            <p className="text-sm text-muted">{t(`results.${k}` as MessageKey)}</p>
          </div>
        ))}
      </section>

      <Button variant="secondary" className="w-auto! self-start px-5" onClick={() => setLearning(true)}>
        {t("results.learn")}
      </Button>

      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <article key={r.postId} className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">{r.product}</h2>
              <p className="text-sm text-muted">{r.date}</p>
            </div>
            {metrics(r)}
            {ordersField(r)}
            <Button variant="text" className="w-auto! self-start px-0" onClick={() => setDetailId(r.postId)}>
              {t("results.view")}
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}

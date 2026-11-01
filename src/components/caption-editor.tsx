"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Carousel } from "./carousel";
import { CopyButton } from "./copy-button";
import { ActionButton } from "./action-button";
import { Button, ButtonLink } from "./button";
import { t } from "@/lib/i18n";
import type { Slide } from "@/lib/posts/slides";

const POLL_MS = 3000;
const GIVE_UP_MS = 60_000;

// Manual caption edit + rewrite from feedback (F-11, FR-ED-01/02, DX-32). Manual edit is sent with Approve, not saved on its own.
export function CaptionEditor({ postId, slides, captions, hashtags }: { postId: string; slides: Slide[]; captions: string[]; hashtags: string[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(captions[0] ?? "");
  const [feedback, setFeedback] = useState("");
  const [limited, setLimited] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [pending, start] = useTransition();
  const seen = useRef(captions.join("\n"));

  const [slideList, setSlideList] = useState(slides);
  const [slideOrder, setSlideOrder] = useState(1);
  const [slideFeedback, setSlideFeedback] = useState("");
  const [remade, setRemade] = useState<number | null>(null);
  const [slideFailed, setSlideFailed] = useState(false);
  const [slidePending, startSlide] = useTransition();
  const unchecked = slideList.some((s) => !s.fidelity_passed);

  // Slide remake (FR-ED-05): scene only, then the product check must pass again (FR-FD-01).
  const remake = () =>
    startSlide(async () => {
      setSlideFailed(false);
      const res = await fetch(`/api/posts/${postId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "slide", slide: slideOrder, feedback: slideFeedback.trim() }),
      }).catch(() => null);
      // The route only accepts target "caption" so far (F-11b is P1); until it ships this shows the error.
      if (res?.ok) {
        setSlideList(slideList.map((s) => (s.order === slideOrder ? { ...s, fidelity_passed: false } : s)));
        setRemade(slideOrder);
        return;
      }
      setSlideFailed(true);
    });

  const choose = (i: number) => {
    setIndex(i);
    setText(captions[i] ?? "");
  };

  // The rewrite runs as a job; re-read the page until new options arrive.
  useEffect(() => {
    if (!waiting) return;
    const poll = setInterval(() => router.refresh(), POLL_MS);
    const giveUp = setTimeout(() => {
      setWaiting(false);
      setFailed(true);
    }, GIVE_UP_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [waiting, router]);

  useEffect(() => {
    const now = captions.join("\n");
    if (!waiting || now === seen.current) return;
    seen.current = now;
    setWaiting(false);
    setIndex(0);
    setText(captions[0] ?? "");
  }, [captions, waiting]);

  const rewrite = () =>
    start(async () => {
      setFailed(false);
      const res = await fetch(`/api/posts/${postId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "caption", feedback: feedback.trim() }),
      }).catch(() => null);
      if (res?.status === 429) return setLimited(true);
      if (!res?.ok) return setFailed(true);
      const data = (await res.json().catch(() => ({}))) as { remaining?: number };
      if (data.remaining === 0) setLimited(true);
      setWaiting(true);
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 pt-2">
        <ButtonLink href="/today" variant="text" className="w-auto! self-start px-0">
          {t("edit.back")}
        </ButtonLink>
        <h1 className="text-4xl font-semibold tracking-tight">{t("edit.title")}</h1>
        <p className="text-muted">{t("edit.body")}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <section aria-label={t("today.carousel")} className="lg:rounded-card lg:border lg:border-border lg:bg-white lg:p-5">
          <Carousel slides={slideList} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} />
        </section>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-card border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t("edit.caption")}</h2>
              <CopyButton text={`${text}\n\n${hashtags.join(" ")}`} className="w-auto! px-2" />
            </div>
            {captions.length > 1 && (
              <div className="flex gap-2" role="group" aria-label={t("edit.chooseCaption", { n: index + 1, total: captions.length })}>
                {captions.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => choose(i)}
                    aria-pressed={i === index}
                    className={`flex h-11 items-center rounded-full border px-4 text-sm font-medium ${i === index ? "border-blue bg-powder text-blue" : "border-border bg-white text-ink"}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <span className="flex items-center text-sm text-muted">{t("edit.chooseCaption", { n: index + 1, total: captions.length })}</span>
              </div>
            )}
            <label className="sr-only" htmlFor="caption">
              {t("edit.caption")}
            </label>
            <textarea
              id="caption"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={2200}
              className="rounded-control border border-border bg-white p-3 font-normal placeholder:text-muted focus:outline-2 focus:outline-blue"
            />
            <p className="text-sm text-muted">{hashtags.join(" ")}</p>
          </section>

          <section className="flex flex-col gap-3 rounded-card border border-border bg-white p-5">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("edit.feedback")}
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder={t("edit.feedbackPlaceholder")}
                className="rounded-control border border-border bg-white p-3 font-normal placeholder:text-muted focus:outline-2 focus:outline-blue"
              />
            </label>
            <Button variant="secondary" onClick={rewrite} disabled={limited || pending || waiting || !feedback.trim()} aria-busy={pending || waiting}>
              {t("edit.rewrite")}
            </Button>
            {limited && (
              <p role="alert" className="text-sm text-danger">
                {t("edit.limit")}
              </p>
            )}
            {failed && (
              <p role="alert" className="text-sm text-danger">
                {t("common.error")}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-card border border-border bg-white p-5">
            <h2 className="text-xl font-semibold">{t("imageEdit.title")}</h2>
            <p className="text-sm text-muted">{t("imageEdit.body")}</p>
            <div className="flex gap-2" role="group" aria-label={t("imageEdit.title")}>
              {slideList.map((s) => (
                <button
                  key={s.order}
                  type="button"
                  onClick={() => setSlideOrder(s.order)}
                  aria-pressed={slideOrder === s.order}
                  className={`flex h-11 items-center rounded-full border px-4 text-sm font-medium ${slideOrder === s.order ? "border-blue bg-powder text-blue" : "border-border bg-white text-ink"}`}
                >
                  {t("imageEdit.slide", { n: s.order })}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t("imageEdit.feedback")}
              <textarea
                value={slideFeedback}
                onChange={(e) => setSlideFeedback(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder={t("imageEdit.feedbackPlaceholder")}
                className="rounded-control border border-border bg-white p-3 font-normal placeholder:text-muted focus:outline-2 focus:outline-blue"
              />
            </label>
            <Button variant="secondary" onClick={remake} disabled={slidePending || !slideFeedback.trim()} aria-busy={slidePending}>
              {t("imageEdit.regenerate")}
            </Button>
            {remade !== null && (
              <p role="alert" className="text-sm text-danger">
                {t("imageEdit.remade", { n: remade })}
              </p>
            )}
            {slideFailed && (
              <p role="alert" className="text-sm text-danger">
                {t("common.error")}
              </p>
            )}
          </section>

          <ActionButton url={`/api/posts/${postId}/approve`} body={{ caption: text }} then="/today" disabled={unchecked}>
            {t("edit.approve")}
          </ActionButton>
          <ButtonLink href="/today" variant="text">
            {t("edit.today")}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

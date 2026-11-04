"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Carousel } from "./carousel";
import { Button, ButtonLink } from "./button";
import { InfoCard } from "./info-card";
import { SlideEditor } from "./slide-editor";
import { StatusScreen } from "./status-screen";
import { t } from "@/lib/i18n";
import type { Slide } from "@/lib/posts/slides";

const POLL_MS = 3000;
const GIVE_UP_MS = 60_000;
const MAX_REWRITES = 5;
const field = "glass rounded-card p-3.5 text-base leading-[1.4] text-ink placeholder:text-muted focus:outline-2 focus:outline-blue";

// Edit the caption (228:10507, F-11, FR-ED-01/02). The edited caption goes to "Publish this post?" and is sent with Approve.
export function CaptionEditor({ postId, slides, captions, initial = 0, product }: { postId: string; slides: Slide[]; captions: string[]; initial?: number; product?: string }) {
  const router = useRouter();
  const [text, setText] = useState(captions[initial] ?? captions[0] ?? "");
  const [feedback, setFeedback] = useState("");
  const [used, setUsed] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [scene, setScene] = useState(false);
  const [pending, start] = useTransition();
  const seen = useRef(captions.join("\n"));
  const limited = used !== null && used >= MAX_REWRITES;

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
      if (res?.status === 429) return setUsed(MAX_REWRITES);
      if (!res?.ok) return setFailed(true);
      const data = (await res.json().catch(() => ({}))) as { remaining?: number };
      if (typeof data.remaining === "number") setUsed(MAX_REWRITES - data.remaining);
      setWaiting(true);
    });

  // Preparing caption options (270:2121): the current caption stays until new options arrive.
  if (waiting) {
    return (
      <StatusScreen title={t("loading.captionsTitle")} body={t("loading.captionsBody")}>
        <div aria-busy="true" aria-live="polite">
          <InfoCard vector="build" title={t("loading.captionsCard")}>
            {t("loading.captionsCardBody")}
          </InfoCard>
        </div>
        <InfoCard vector="check" title={t("loading.waitTitle")}>
          {t("loading.waitBody")}
        </InfoCard>
      </StatusScreen>
    );
  }

  const preview = <Carousel slides={slides} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} eyebrow={product} />;

  // Slide editor (SRD A-09): replaces the disabled background screen (228:11424).
  if (scene) return <SlideEditor postId={postId} slides={slides} onClose={() => setScene(false)} />;

  return (
    <StatusScreen title={t("edit.title")} body={t("edit.body")}>
      <label className="flex flex-col gap-4 text-sm font-medium">
        {t("edit.caption")}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2200} className={`${field} font-normal`} />
      </label>
      <label className="flex flex-col gap-4 text-sm font-medium">
        {t("edit.feedback")}
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} maxLength={200} placeholder={t("edit.feedbackPlaceholder")} className={`${field} font-normal`} />
      </label>
      {used !== null && <p className="text-[13px] text-muted">{t("edit.used", { n: used })}</p>}
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
      <Button onClick={rewrite} disabled={limited || pending || !feedback.trim()} aria-busy={pending}>
        {t("edit.rewrite")}
      </Button>
      {text.trim() ? (
        <ButtonLink href={`/today?post=${postId}&caption=${encodeURIComponent(text.trim())}`} variant="secondary">
          {t("edit.save")}
        </ButtonLink>
      ) : (
        <Button variant="secondary" disabled>
          {t("edit.save")}
        </Button>
      )}
      <div className="mx-auto w-full max-w-90">{preview}</div>
      <Button variant="secondary" onClick={() => setScene(true)}>
        {t("edit.slides")}
      </Button>
      <ButtonLink href={`/today?post=${postId}`} variant="text">
        {t("edit.cancel")}
      </ButtonLink>
    </StatusScreen>
  );
}

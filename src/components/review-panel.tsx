"use client";

import { useState, type ReactNode } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { ActionButton } from "./action-button";
import { Button, ButtonLink } from "./button";
import { InfoCard } from "./info-card";

const REASONS = ["not_my_style", "wrong_product", "bad_timing", "other"] as const;

// Caption choice + Edit + skip with reason chips (FR-TD-03, DX-05). `children` is the "why" section.
export function ReviewPanel({ postId, captions, hashtags, canSkip = true, children }: { postId: string; scoped?: boolean; captions: string[]; hashtags: string[]; canSkip?: boolean; children?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [picking, setPicking] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState("");
  const caption = captions[index] ?? "";

  // Choose a caption (228:11545).
  if (picking) {
    return (
      <section className="flex flex-col gap-4 leading-[1.4]">
        <h2 className="text-[30px] font-semibold">{t("captionAlt.title")}</h2>
        <p className="text-muted">{t("captionAlt.body")}</p>
        {captions.map((c, i) => (
          <div key={i} className="glass flex flex-col gap-3 rounded-card p-5">
            <h3 className="text-sm font-semibold text-blue">{t("captionAlt.option", { n: i + 1 })}</h3>
            <p className="text-[15px] text-muted">{c}</p>
            <Button variant={i === index ? "primary" : "secondary"} aria-pressed={i === index} onClick={() => { setIndex(i); setPicking(false); }}>
              {t("captionAlt.useN", { n: i + 1 })}
            </Button>
          </div>
        ))}
        <InfoCard vector="voice" title={t("captionAlt.settingsTitle")}>
          {t("captionAlt.settingsBody")}
        </InfoCard>
        <ButtonLink href={`/posts/${postId}/edit?c=${index}`} variant="text">
          {t("captionAlt.editManually")}
        </ButtonLink>
      </section>
    );
  }

  // Skip this post (228:11065).
  if (skipping) {
    return (
      <section className="flex flex-col gap-4 leading-[1.4]">
        <h2 className="text-[30px] font-semibold">{t("skip.title")}</h2>
        <p className="text-muted">{t("skip.body")}</p>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{t("skip.reasonLabel")}</legend>
          {REASONS.map((r) => (
            <label key={r} className={`flex h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-blue ${reason === r ? "border-blue bg-powder text-blue" : "border-border bg-white text-slate"}`}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="sr-only" />
              {t(`skip.${r}` as MessageKey)}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("skip.note")}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder={t("skip.notePlaceholder")}
            className="rounded-control border border-border bg-white p-3 font-normal placeholder:text-muted focus:outline-2 focus:outline-blue"
          />
        </label>
        <ActionButton url={`/api/posts/${postId}/skip`} body={{ reason: reason ?? undefined, note: note.trim() || undefined }}>
          {t("skip.confirm")}
        </ActionButton>
        <Button variant="text" onClick={() => setSkipping(false)}>
          {t("skip.keep")}
        </Button>
      </section>
    );
  }

  // Mobile: separate glass cards. Desktop: one "Ready for your review" card (2 Nov design).
  return (
    <div className="flex flex-col gap-2.5 lg:glass lg:gap-4 lg:rounded-2xl lg:p-6">
      <h2 className="hidden text-xl leading-[1.45] font-semibold lg:block">{t("today.ready")}</h2>
      <section data-tour="caption" className="flex flex-col gap-3 max-lg:glass max-lg:rounded-card max-lg:p-5 lg:py-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
        <img src="/figma/vector-voice.svg" width={78} height={50} alt="" />
        <h2 className="text-lg leading-[1.4] font-semibold">{t("today.caption")}</h2>
        <p className="text-[15px] leading-[1.4] whitespace-pre-line text-muted lg:text-base">{caption}</p>
        {captions.length > 1 && (
          <Button variant="text" onClick={() => setPicking(true)}>
            {t("today.choose")}
          </Button>
        )}
        <p className="text-[13px] leading-[1.4] text-blue">{hashtags.join(" ")}</p>
      </section>
      {children}

      {/* No Approve: publishing to Instagram is not built yet. The owner downloads the slides instead. */}
      <div className={`grid gap-2.5 lg:gap-3 ${canSkip ? "grid-cols-2" : ""}`}>
        <ButtonLink data-tour="approve" href={`/posts/${postId}/edit?c=${index}`} variant="secondary">
          {t("today.edit")}
        </ButtonLink>
        {canSkip && (
          <Button variant="secondary" className="lg:border-transparent! lg:bg-transparent! lg:text-sm lg:font-normal! lg:text-link!" onClick={() => setSkipping(true)}>
            {t("today.skip")}
          </Button>
        )}
      </div>
    </div>
  );
}

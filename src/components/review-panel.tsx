"use client";

import { useState } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { ActionButton } from "./action-button";
import { Button, ButtonLink } from "./button";
import { CopyButton } from "./copy-button";

const REASONS = ["not_my_style", "wrong_product", "bad_timing", "other"] as const;

// Caption choice + one-tap Approve (DX-01) + skip with reason chips (FR-TD-03, DX-05).
export function ReviewPanel({ postId, captions, hashtags }: { postId: string; captions: string[]; hashtags: string[] }) {
  const [index, setIndex] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState("");
  const caption = captions[index] ?? "";
  const full = `${caption}\n\n${hashtags.join(" ")}`;

  if (skipping) {
    return (
      <section className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
        <h2 className="text-xl font-semibold">{t("skip.title")}</h2>
        <p className="text-sm text-muted">{t("skip.body")}</p>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{t("skip.reasonLabel")}</legend>
          {REASONS.map((r) => (
            <label key={r} className={`flex h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-blue ${reason === r ? "border-blue bg-powder text-blue" : "border-border bg-white text-ink"}`}>
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

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-card border border-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("today.caption")}</h2>
          <CopyButton text={full} className="w-auto! px-2" />
        </div>
        <p className="whitespace-pre-line">{caption}</p>
        {captions.length > 1 && (
          <Button variant="text" className="justify-start! px-0!" onClick={() => setIndex((index + 1) % captions.length)}>
            {t("today.chooseCaption", { n: index + 1, total: captions.length })}
          </Button>
        )}
        <p className="text-sm text-muted">{hashtags.join(" ")}</p>
      </section>

      <ActionButton url={`/api/posts/${postId}/approve`} body={{ caption }}>
        {t("today.approve")}
      </ActionButton>
      <div className="grid grid-cols-2 gap-3">
        <ButtonLink href={`/posts/${postId}/edit`} variant="secondary">
          {t("today.edit")}
        </ButtonLink>
        <Button variant="secondary" onClick={() => setSkipping(true)}>
          {t("today.skip")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button, ButtonLink } from "./button";
import { CopyButton } from "./copy-button";
import { StatusScreen } from "./status-screen";
import { t } from "@/lib/i18n";
import type { Slide } from "@/lib/posts/slides";

// Download fallback (FR-PB-04, 98:1340): ready only after every slide is downloaded, and ready is not published.
export function DownloadFlow({ slides, captionText }: { slides: Slide[]; captionText: string }) {
  const [done, setDone] = useState<number[]>([]);
  const ready = slides.length > 0 && done.length === slides.length;

  if (ready) {
    return (
      <StatusScreen icon="✓" title={t("status.filesReady.title")} body={t("status.filesReady.body")}>
        <CopyButton text={captionText} variant="secondary" />
        <Button variant="text" onClick={() => setDone([])}>
          {t("status.filesReady.again")}
        </Button>
      </StatusScreen>
    );
  }

  return (
    <StatusScreen icon="↓" title={t("status.download.title")} body={t("status.download.body")}>
      {slides.map((s) => (
        <ButtonLink
          key={s.order}
          href={s.slide_path}
          download={`slide-${s.order}.png`}
          variant={s.order === 1 ? "primary" : "secondary"}
          onClick={() => setDone((d) => (d.includes(s.order) ? d : [...d, s.order]))}
        >
          {t("status.download.slide", { n: s.order })}
        </ButtonLink>
      ))}
      <CopyButton text={captionText} variant="secondary" />
      <p className="text-sm text-muted">{t("status.filesReady.progress", { n: done.length, total: slides.length })}</p>
      <p className="text-sm text-muted">{t("status.download.note")}</p>
    </StatusScreen>
  );
}

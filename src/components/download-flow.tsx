"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "./button";
import { CopyButton } from "./copy-button";
import { InfoCard } from "./info-card";
import { StatusScreen } from "./status-screen";
import { t } from "@/lib/i18n";
import type { Slide } from "@/lib/posts/slides";

// Download fallback (FR-PB-04, 228:10910 / 228:12397): complete only after the slides are saved, and complete is not published.
export function DownloadFlow({ slides, downloads = [], captionText, connected, backHref = "/posts", children }: { slides: Slide[]; downloads?: string[]; captionText: string; connected: boolean; backHref?: string; children?: ReactNode }) {
  const [done, setDone] = useState(false);

  const downloadAll = () => {
    for (const s of slides) {
      const a = document.createElement("a");
      a.href = downloads[s.order - 1] ?? s.slide_path;
      a.download = `slide-${s.order}.png`;
      a.click();
    }
    setDone(true);
  };

  if (done) {
    return (
      <StatusScreen title={t("status.filesReady.title")} body={t("status.filesReady.body")}>
        <InfoCard vector="plan" title={t("status.filesReady.cardTitle")}>
          {t("status.filesReady.cardBody")}
        </InfoCard>
        <ButtonLink href={backHref}>{t("status.backToday")}</ButtonLink>
        <Button variant="secondary" onClick={() => setDone(false)}>
          {t("status.filesReady.instructions")}
        </Button>
      </StatusScreen>
    );
  }

  return (
    <StatusScreen title={t("status.download.title")} body={t(connected ? "status.download.bodyChosen" : "status.download.body")}>
      <InfoCard vector="plan" title={t("status.download.s1Title")}>{t("status.download.s1Body")}</InfoCard>
      <InfoCard vector="voice" title={t("status.download.s2Title")}>{t("status.download.s2Body")}</InfoCard>
      <InfoCard vector="social" title={t("status.download.s3Title")}>{t("status.download.s3Body")}</InfoCard>
      <p className="font-medium text-blue">{t("status.download.note")}</p>
      <Button onClick={downloadAll} disabled={slides.length === 0}>
        {t("status.download.all")}
      </Button>
      <CopyButton text={captionText} variant="secondary" />
      <ButtonLink href={backHref} variant="text">
        {t("status.backToday")}
      </ButtonLink>
      {children}
    </StatusScreen>
  );
}

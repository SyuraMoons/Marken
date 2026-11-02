import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { ActivityPanel } from "@/components/activity-panel";
import { AutoRefresh } from "@/components/auto-refresh";
import { ButtonLink } from "@/components/button";
import { Carousel } from "@/components/carousel";
import { DownloadFlow } from "@/components/download-flow";
import { InfoCard } from "@/components/info-card";
import { PageHeader } from "@/components/page-header";
import { ReviewPanel } from "@/components/review-panel";
import { Stage, Stages } from "@/components/stages";
import { StatusScreen } from "@/components/status-screen";
import { t } from "@/lib/i18n";
import { getTodayData } from "@/lib/data/today";
import { allSlidesPassed } from "@/lib/posts/slides";

// Today (F-10, FR-TD-01..04, FR-FD-03, F-24). One screen per post status; ?view= opens the post's sub-pages (Figma page 01).
export default function TodayPage({ searchParams }: PageProps<"/today">) {
  return (
    <Suspense fallback={<div className="aspect-[4/5] max-w-120 animate-pulse rounded-card bg-white" />}>
      <Today searchParams={searchParams} />
    </Suspense>
  );
}

async function Today({ searchParams }: Pick<PageProps<"/today">, "searchParams">) {
  const q = await searchParams;
  const data = await getTodayData();
  if (!data) redirect("/login");
  const { shop, post, steps, calls } = data;
  const back = (
    <ButtonLink href="/today" variant="text">
      {t("status.backToday")}
    </ButtonLink>
  );

  if (!post) {
    return (
      <StatusScreen title={t("status.none.title")} body={t("status.none.body")}>
        <ActionButton url={`/api/shops/${shop.id}/posts/generate`}>{t("status.none.action")}</ActionButton>
      </StatusScreen>
    );
  }

  const { slides, downloads, trend, photo } = data;
  const captions = (post.caption_options as string[]) ?? [];
  const pick = Number(q.c);
  // An edited caption from Edit arrives as ?caption= (owners cannot write posts directly, FD-08).
  const edited = typeof q.caption === "string" && q.caption.trim() ? q.caption.trim().slice(0, 2200) : null;
  const caption = edited ?? (Number.isInteger(pick) && captions[pick] ? captions[pick] : (post.chosen_caption ?? captions[0] ?? ""));
  const captionText = `${caption}\n\n${post.hashtags.join(" ")}`;
  const connected = Boolean(shop.ig_account_id);

  // Activity (228:10153): a plain-language summary; real per-step data lives in Run details (FD-28).
  if (q.view === "activity") {
    return (
      <StatusScreen title={t("activity.title")} body={t("activity.body")}>
        <Stages />
        <a href="/today?view=details" className="rounded-card focus-visible:outline-2 focus-visible:outline-blue">
          <Stage icon="details" title={t("activity.s6")} body={t("activity.s6Body")} />
        </a>
        <ButtonLink href="/today">{t("status.backToday")}</ButtonLink>
        {allSlidesPassed(slides) && photo?.src && (
          <ButtonLink href="/today?view=compare" variant="secondary">
            {t("activity.accuracy")}
          </ButtonLink>
        )}
      </StatusScreen>
    );
  }

  // Run details (228:12913, FR-AP-01): model, latency, cost, cache and fallback per step.
  if (q.view === "details") {
    return (
      <StatusScreen title={t("activity.detailsTitle")} body={t("activity.body")}>
        <ActivityPanel steps={steps} calls={calls} open />
        {back}
      </StatusScreen>
    );
  }

  // Compare (228:10384, FR-FD-03): only exists when the badge does, all slides passed.
  if (q.view === "compare" && allSlidesPassed(slides) && photo?.src) {
    return (
      <StatusScreen title={t("compare.title")} body={t("compare.body")}>
        <div className="grid grid-cols-2 gap-3">
          {[
            { src: photo.src, alt: `${photo.name}, your original photo`, label: t("compare.before") },
            { src: slides[1].slide_path, alt: slides[1].alt, label: t("compare.after") },
          ].map((x) => (
            <figure key={x.label} className="flex flex-col gap-2">
              <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-white">
                <Image src={x.src} alt={x.alt} fill sizes="(min-width: 1024px) 280px, 45vw" className="object-cover" />
              </div>
              <figcaption className="text-sm font-semibold">{x.label}</figcaption>
            </figure>
          ))}
        </div>
        <InfoCard vector="check" title={t("compare.passTitle")}>
          {t("compare.passBody")}
        </InfoCard>
        {back}
      </StatusScreen>
    );
  }

  // Download instead (228:10910): from the publish screen or a failed publish.
  if (q.view === "download" && allSlidesPassed(slides)) {
    return <DownloadFlow slides={slides} downloads={downloads} captionText={captionText} connected={connected} />;
  }

  // A ready post with a failed product check never offers Approve (FR-FD-01).
  const unchecked = post.status === "ready" ? slides.find((s) => !s.fidelity_passed) : undefined;
  if (unchecked || (post.status === "ready" && slides.length === 0)) {
    return <FidelityFailed shopId={shop.id} slide={unchecked?.order ?? 1} />;
  }

  // Publish this post? (228:10628, SRD v2.1 A-04): Approve opens it so the owner sees where it goes.
  if (q.view === "share" && post.status === "ready") {
    return (
      <StatusScreen title={t("share.title")} body={t("share.body")}>
        <div className="mx-auto w-full max-w-90">
          <Carousel slides={slides} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} eyebrow={photo?.name} />
        </div>
        <section className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-5 leading-[1.4]">
          <h2 className="text-sm font-semibold">{t("share.to")}</h2>
          <Platform icon="instagram" name={`${t("share.instagram")}${connected ? "  ✓" : ""}`} note={t(connected ? "share.igConnected" : "share.igMissing")} selected />
          {/* shortcut: Facebook has no publish route yet (A-04), so it is shown but cannot be picked. */}
          <Platform icon="facebook" name={t("share.facebook")} note={t("share.fbSoon")} />
        </section>
        <InfoCard vector="check" title={t("share.readyTitle")}>
          {t("share.readyBody")}
        </InfoCard>
        <ActionButton url={`/api/posts/${post.id}/approve`} body={{ caption }} then="/today">
          {t("share.approve")}
        </ActionButton>
        <ButtonLink href={`/today?view=download&caption=${encodeURIComponent(caption)}`} variant="secondary">
          {t("share.download")}
        </ButtonLink>
        <ButtonLink href={`/posts/${post.id}/edit`} variant="text">
          {t("share.keepEditing")}
        </ButtonLink>
      </StatusScreen>
    );
  }

  switch (post.status) {
    case "generating":
      return (
        <StatusScreen title={t("status.generating.title")} body={t("status.generating.body")}>
          <AutoRefresh />
          <InfoCard vector="build" title={t("status.generating.cardTitle")}>
            {t("status.savedBody")}
          </InfoCard>
          <ButtonLink href="/today?view=details" variant="secondary">
            {t("status.liveSteps")}
          </ButtonLink>
          <InfoCard vector="check" title={t("status.approvalTitle")}>
            {t("status.approvalBody")}
          </InfoCard>
        </StatusScreen>
      );

    case "approved":
    case "publishing":
      // Not connected: download + copy caption, approve still completes (FR-PB-04).
      if (!connected) return <DownloadFlow slides={slides} downloads={downloads} captionText={captionText} connected={false} />;
      return (
        <StatusScreen title={t("status.publishing.title")} body={t("status.publishing.body")}>
          <AutoRefresh />
          <InfoCard vector="social" title={t("status.publishing.cardTitle")}>
            {t("status.savedBody")}
          </InfoCard>
          <ButtonLink href="/today?view=details" variant="secondary">
            {t("status.liveSteps")}
          </ButtonLink>
        </StatusScreen>
      );

    case "published":
      return (
        <StatusScreen title={t("status.published.title")} body={t("status.published.body")}>
          {post.permalink && (
            <ButtonLink href={post.permalink} target="_blank" rel="noopener noreferrer">
              {t("status.published.action")}
            </ButtonLink>
          )}
          <InfoCard vector="plan" title={t("status.published.nextTitle")}>
            {t("status.published.nextBody")}
          </InfoCard>
        </StatusScreen>
      );

    case "failed": {
      const bad = slides.find((s) => !s.fidelity_passed);
      // A failed product check never offers Approve (FR-FD-01); a failed publish retries via Approve.
      if (bad) return <FidelityFailed shopId={shop.id} slide={bad.order} />;
      if (!post.approved_at) {
        return (
          <StatusScreen title={t("status.genFailed.title")} body={t("status.genFailed.body")}>
            <ActionButton url={`/api/shops/${shop.id}/posts/generate`}>{t("status.fidelity.action")}</ActionButton>
            <ButtonLink href="/today?view=details" variant="secondary">
              {t("status.failed.viewStep")}
            </ButtonLink>
          </StatusScreen>
        );
      }
      return (
        <StatusScreen title={t("status.failed.title")} body={t("status.failed.body")}>
          <InfoCard vector="clock" title={t("status.failed.cardTitle")}>
            {t("status.failed.cardBody")}
          </InfoCard>
          <ActionButton url={`/api/posts/${post.id}/approve`} body={{ caption }}>
            {t("status.failed.action")}
          </ActionButton>
          <ButtonLink href="/today?view=details" variant="secondary">
            {t("status.failed.viewStep")}
          </ButtonLink>
          <ButtonLink href="/today?view=download" variant="secondary">
            {t("status.failed.download")}
          </ButtonLink>
        </StatusScreen>
      );
    }

    case "skipped":
      return (
        <StatusScreen title={t("status.skipped.title")} body={t("status.skipped.body")}>
          <InfoCard vector="clock" title={t("status.skipped.cardTitle")}>
            {t("status.skipped.cardBody")}
          </InfoCard>
          <ButtonLink href="/today?view=details" variant="secondary">
            {t("status.skipped.viewActivity")}
          </ButtonLink>
        </StatusScreen>
      );
  }

  // ready (Figma 228:9965 / 228:10045)
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader eyebrow={t("today.eyebrow")} title={t("today.title")} body={t("today.subtitle")} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,616fr)_minmax(0,496fr)]">
        <section aria-label={t("today.carousel")} className="flex flex-col gap-2.5 lg:glass lg:gap-4 lg:rounded-2xl lg:p-6">
          <div className="hidden justify-between text-xs leading-[1.45] text-muted lg:flex">
            <span className="font-semibold uppercase">{t("today.carousel")}</span>
            <span>{t("today.slidesMeta")}</span>
          </div>
          <div className="lg:rounded-[14px] lg:bg-[radial-gradient(circle_at_14%_50%,#e5f0ff,#f9f9ff)] lg:p-6">
            <div className="mx-auto w-full lg:max-w-80">
              <Carousel slides={slides} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} eyebrow={photo?.name} />
            </div>
          </div>
          {allSlidesPassed(slides) && photo?.src && (
            <ButtonLink href="/today?view=compare" variant="secondary">
              {t("today.compare")}
            </ButtonLink>
          )}
        </section>

        <ReviewPanel postId={post.id} captions={captions} hashtags={post.hashtags}>
          <section className="flex flex-col gap-3 max-lg:glass max-lg:rounded-card max-lg:px-5 max-lg:py-6 lg:py-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
            <img src="/figma/vector-research.svg" width={78} height={50} alt="" />
            <h2 className="text-lg leading-[1.4] font-semibold">{t("today.why")}</h2>
            <p className="text-[15px] leading-[1.4] text-muted">{post.fit_reason}</p>
            {trend?.url && (
              <a href={trend.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center text-sm text-link hover:underline">
                {t("today.trendSource")}
              </a>
            )}
          </section>
        </ReviewPanel>
      </div>
    </div>
  );
}

// Product check failed (228:11908): Approve is never offered (FR-FD-01).
function FidelityFailed({ shopId, slide }: { shopId: string; slide: number }) {
  return (
    <StatusScreen title={t("status.fidelity.title")} body={t("status.fidelity.body")}>
      <InfoCard vector="check" title={t("status.fidelity.cardTitle", { n: slide })}>
        {t("status.fidelity.cardBody")}
      </InfoCard>
      <ActionButton url={`/api/shops/${shopId}/posts/generate`}>{t("status.fidelity.action")}</ActionButton>
      <ButtonLink href="/today?view=details" variant="secondary">
        {t("status.failed.viewStep")}
      </ButtonLink>
    </StatusScreen>
  );
}

// A publish destination row (228:10649).
function Platform({ icon, name, note, selected }: { icon: string; name: string; note: string; selected?: boolean }) {
  return (
    <div aria-disabled={!selected} className={`flex items-center gap-2.5 rounded-control p-3 ${selected ? "bg-powder" : "opacity-70"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static platform icon */}
      <img src={`/figma/platform-${icon}.svg`} width={28} height={28} alt="" />
      <span className="flex flex-col gap-[3px]">
        <span className="text-sm font-semibold whitespace-pre-wrap">{name}</span>
        <span className="text-xs text-muted">{note}</span>
      </span>
    </div>
  );
}

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { ActivityPanel } from "@/components/activity-panel";
import { AutoRefresh } from "@/components/auto-refresh";
import { ButtonLink } from "@/components/button";
import { Carousel } from "@/components/carousel";
import { CopyButton } from "@/components/copy-button";
import { ProductCheck } from "@/components/product-check";
import { ReviewPanel } from "@/components/review-panel";
import { StatusScreen } from "@/components/status-screen";
import { t } from "@/lib/i18n";
import { getTodayData } from "@/lib/data/today";
import { allSlidesPassed } from "@/lib/posts/slides";

// Today (F-10, FR-TD-01..04, FR-FD-03, F-24). One screen per post status.
export default function TodayPage() {
  return (
    <Suspense fallback={<div className="aspect-[4/5] max-w-120 animate-pulse rounded-card bg-white" />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const data = await getTodayData();
  if (!data) redirect("/login");
  const { shop, post, steps, calls } = data;
  const activity = <ActivityPanel steps={steps} calls={calls} />;

  if (!post) {
    return (
      <StatusScreen icon="✦" title={t("status.none.title")} body={t("status.none.body")}>
        <ActionButton url={`/api/shops/${shop.id}/posts/generate`}>{t("status.none.action")}</ActionButton>
      </StatusScreen>
    );
  }

  const { slides, downloads, trend, photo } = data;
  const captions = (post.caption_options as string[]) ?? [];
  const caption = post.chosen_caption ?? captions[0] ?? "";

  // A ready post with a failed product check never offers Approve (FR-FD-01).
  const unchecked = post.status === "ready" ? slides.find((s) => !s.fidelity_passed) : undefined;
  if (unchecked || (post.status === "ready" && slides.length === 0)) {
    return (
      <StatusScreen icon="!" title={t("status.fidelity.title")} body={t("status.fidelity.body", { n: unchecked?.order ?? 1 })}>
        <ActionButton url={`/api/shops/${shop.id}/posts/generate`}>{t("status.fidelity.action")}</ActionButton>
        <ActivityPanel steps={steps} calls={calls} open />
      </StatusScreen>
    );
  }

  switch (post.status) {
    case "generating":
      return (
        <StatusScreen icon="✦" title={t("status.generating.title")} body={t("status.generating.body")}>
          <AutoRefresh />
          <ActivityPanel steps={steps} calls={calls} open />
          <p className="text-sm text-muted">{t("status.control")}</p>
        </StatusScreen>
      );

    case "approved":
    case "publishing":
      // Not connected → download + copy caption, approve still completes (FR-PB-04).
      if (!shop.ig_account_id) {
        return (
          <StatusScreen icon="↓" title={t("status.download.title")} body={t("status.download.body")}>
            {slides.map((s) => (
              <ButtonLink key={s.order} href={downloads[s.order - 1] ?? s.slide_path} download={`slide-${s.order}.png`} variant={s.order === 1 ? "primary" : "secondary"}>
                {t("status.download.slide", { n: s.order })}
              </ButtonLink>
            ))}
            <CopyButton text={`${caption}\n\n${post.hashtags.join(" ")}`} variant="secondary" />
            <p className="text-sm text-muted">{t("status.download.note")}</p>
          </StatusScreen>
        );
      }
      return (
        <StatusScreen icon="↗" title={t("status.publishing.title")} body={t("status.publishing.body")}>
          <AutoRefresh />
          {activity}
        </StatusScreen>
      );

    case "published":
      return (
        <StatusScreen icon="✓" title={t("status.published.title")} body={t("status.published.body")}>
          {post.permalink && (
            <ButtonLink href={post.permalink} target="_blank" rel="noopener noreferrer">
              {t("status.published.action")}
            </ButtonLink>
          )}
          {activity}
        </StatusScreen>
      );

    case "failed": {
      const bad = slides.find((s) => !s.fidelity_passed);
      // A failed product check never offers Approve (FR-FD-01); a failed publish retries via Approve.
      if (bad || !post.approved_at) {
        return (
          <StatusScreen
            icon="!"
            title={t(bad ? "status.fidelity.title" : "status.failed.title")}
            body={bad ? t("status.fidelity.body", { n: bad.order }) : t("status.genFailed.body")}
          >
            <ActionButton url={`/api/shops/${shop.id}/posts/generate`}>{t("status.fidelity.action")}</ActionButton>
            <ActivityPanel steps={steps} calls={calls} open />
          </StatusScreen>
        );
      }
      return (
        <StatusScreen icon="!" title={t("status.failed.title")} body={t("status.failed.body")}>
          <ActionButton url={`/api/posts/${post.id}/approve`} body={{ caption }}>
            {t("status.failed.action")}
          </ActionButton>
          {activity}
        </StatusScreen>
      );
    }

    case "skipped":
      return (
        <StatusScreen icon="–" title={t("status.skipped.title")} body={t("status.skipped.body")}>
          {activity}
        </StatusScreen>
      );
  }

  // ready
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 pt-2">
        <h1 className="text-4xl font-semibold tracking-tight">{t("today.title")}</h1>
        <p className="text-muted">{t("today.subtitle")}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <section aria-label={t("today.carousel")} className="flex flex-col gap-3 lg:rounded-card lg:border lg:border-border lg:bg-white lg:p-5">
          <Carousel slides={slides} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} />
          {allSlidesPassed(slides) && photo?.src && (
            <ProductCheck
              photo={photo}
              slide={slides[1]}
              labels={{ badge: t("today.badge"), before: t("today.before"), after: t("today.after") }}
            />
          )}
        </section>

        <div className="flex flex-col gap-4">
          <ReviewPanel postId={post.id} captions={captions} hashtags={post.hashtags} />
          <section className="flex flex-col gap-2 rounded-card border border-border bg-white p-5">
            <h2 className="text-xl font-semibold">{t("today.why")}</h2>
            <p className="text-muted">{post.fit_reason}</p>
            {trend?.url && (
              <a href={trend.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-sm font-medium text-blue hover:underline">
                {t("today.trendSource", { title: trend.title })}
              </a>
            )}
          </section>
          {activity}
        </div>
      </div>
    </div>
  );
}

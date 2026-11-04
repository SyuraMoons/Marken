import { asCaptions } from "@/lib/posts/captions";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { ActivityPanel, stepLabel } from "@/components/activity-panel";
import { AutoRefresh } from "@/components/auto-refresh";
import { ButtonLink } from "@/components/button";
import { Carousel } from "@/components/carousel";
import { InfoCard } from "@/components/info-card";
import { PageHeader } from "@/components/page-header";
import { PostTools } from "@/components/post-tools";
import { canDeletePost } from "@/lib/posts/deletable";
import { ReviewPanel } from "@/components/review-panel";
import { StatusScreen } from "@/components/status-screen";
import { t, type MessageKey } from "@/lib/i18n";
import { getOwnerShop, getPostHistory, getTodayData } from "@/lib/data/today";
import { shopToday } from "@/lib/api/owner";
import { TodayFeed } from "@/components/today-feed";

type TodayData = Extract<NonNullable<Awaited<ReturnType<typeof getTodayData>>>, { missing: false }>;
import { allSlidesPassed } from "@/lib/posts/slides";

// Today (F-10, FR-TD-01..04, FR-FD-03, F-24). Plain /today is the feed of every morning's post plus a calendar
// (Figma 01 Today › today-feed); ?post=<id> opens one post's detail, and ?view= its sub-pages (Figma page 01).
export default function TodayPage({ searchParams }: PageProps<"/today">) {
  return (
    <Suspense fallback={<div className="aspect-[4/5] max-w-120 animate-pulse rounded-card bg-white" />}>
      <Today searchParams={searchParams} />
    </Suspense>
  );
}

async function Today({ searchParams }: Pick<PageProps<"/today">, "searchParams">) {
  const q = await searchParams;
  if (typeof q.post !== "string" && typeof q.view !== "string") return <Feed tab={q.tab === "calendar" ? "calendar" : "posts"} />;
  // ?post= opens one earlier post from History; every link below carries it so sub-views stay on that post.
  const data = await getTodayData(typeof q.post === "string" ? q.post : undefined);
  if (!data) redirect("/login");
  if (data.missing) notFound();
  return (
    <>
      {data.post && typeof q.post === "string" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-control bg-powder px-4 py-3 text-sm">
          <ButtonLink href="/today" variant="text" className="w-auto! font-semibold!">
            {t("history.back")}
          </ButtonLink>
          <span className="text-muted">{t("history.from", { date: formatDay(data.post.post_date) })}</span>
        </div>
      )}
      <TodayView q={q} data={data} />
    </>
  );
}

async function Feed({ tab }: { tab: "posts" | "calendar" }) {
  const [owner, posts] = await Promise.all([getOwnerShop(), getPostHistory()]);
  if (!owner || !posts) redirect("/login");
  const { shop } = owner;
  return <TodayFeed shopName={shop.name ?? ""} today={shopToday(shop.time_zone)} posts={posts} tab={tab} generateUrl={`/api/shops/${shop.id}/posts/generate`} />;
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function TodayView({ q, data }: { q: Awaited<PageProps<"/today">["searchParams"]>; data: TodayData }) {
  const { shop, post, steps, calls } = data;
  // Links to this screen keep the open post, so a post from History stays open through share, download and compare.
  const today = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ ...(post && q.post ? { post: post.id } : {}), ...extra });
    return params.size ? `/today?${params}` : "/today";
  };
  const back = (
    <ButtonLink href={today()} variant="text">
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

  const { slides, downloads, trend, photo, productName } = data;
  const captions = asCaptions(post.caption_options);
  const pick = Number(q.c);
  // An edited caption from Edit arrives as ?caption= (owners cannot write posts directly, FD-08).
  const edited = typeof q.caption === "string" && q.caption.trim() ? q.caption.trim().slice(0, 2200) : null;
  const caption = edited ?? (Number.isInteger(pick) && captions[pick] ? captions[pick] : (post.chosen_caption ?? captions[0] ?? ""));
  const connected = Boolean(shop.ig_account_id);

  // Activity (228:10153): a plain-language summary; real per-step data lives in Run details (FD-28).
  if (q.view === "activity") {
    return (
      <StatusScreen title={t("activity.title")} body={t("activity.body")}>
        {(post.status === "generating" || post.status === "publishing" || post.status === "approved") && <AutoRefresh />}
        <ActivityPanel steps={steps} calls={calls} open />
        <ButtonLink href={today()}>{t("status.backToday")}</ButtonLink>
        {allSlidesPassed(slides) && photo?.src && (
          <ButtonLink href={today({ view: "compare" })} variant="secondary">
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

  if (post.status === "generating") {
    return <Studio cutout={data.cutout} productName={productName} steps={steps} calls={calls} />;
  }

  // A post whose product check failed shows no slides (FR-FD-01).
  const unchecked = slides.find((s) => !s.fidelity_passed);
  if (unchecked || (post.status === "ready" && slides.length === 0)) {
    return <FidelityFailed shopId={shop.id} postId={post.id} slide={unchecked?.order ?? 1} steps={steps} calls={calls} />;
  }
  if (slides.length === 0) {
    return (
      <StatusScreen title={t("status.genFailed.title")} body={t("status.genFailed.body")}>
        <ActionButton url={`/api/shops/${shop.id}/posts/generate`}>{t("status.fidelity.action")}</ActionButton>
        <PostTools postId={post.id} downloads={[]} canDelete={canDeletePost(post, connected)} />
        <ActivityPanel steps={steps} calls={calls} open />
      </StatusScreen>
    );
  }

  // Review (Figma 228:9965 / 228:10045). Every finished post, whatever its status, opens here so the owner
  // can always see the generated slides. Publishing to Instagram is not built yet, so there is no Approve.
  const statusKey = `history.status.${post.status}` as MessageKey;
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader eyebrow={q.post ? t(statusKey) : t("today.eyebrow")} title={t("today.title")} body={t("today.subtitle")} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,616fr)_minmax(0,496fr)]">
        <section data-tour="carousel" aria-label={t("today.carousel")} className="flex flex-col gap-2.5 lg:glass lg:gap-4 lg:rounded-2xl lg:p-6">
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
            <ButtonLink href={today({ view: "compare" })} variant="secondary">
              {t("today.compare")}
            </ButtonLink>
          )}
          {post.status === "published" && post.permalink && (
            <ButtonLink href={post.permalink} target="_blank" rel="noopener noreferrer" variant="secondary">
              {t("status.published.action")}
            </ButtonLink>
          )}
          <PostTools postId={post.id} downloads={downloads} canDelete={canDeletePost(post, connected)} />
          {/* How this post was made sits under the result, not in a separate tab. */}
          <ActivityPanel steps={steps} calls={calls} />
        </section>

        <ReviewPanel postId={post.id} scoped={Boolean(q.post)} captions={[...new Set([caption, ...captions].filter(Boolean))]} hashtags={post.hashtags} canSkip={post.status === "ready"}>
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

type Steps = TodayData["steps"];
type Calls = TodayData["calls"];

// Product check failed (228:11908): Approve is never offered (FR-FD-01).
function FidelityFailed({ shopId, postId, slide, steps, calls }: { shopId: string; postId: string; slide: number; steps: Steps; calls: Calls }) {
  return (
    <StatusScreen title={t("status.fidelity.title")} body={t("status.fidelity.body")}>
      <InfoCard vector="check" title={t("status.fidelity.cardTitle", { n: slide })}>
        {t("status.fidelity.cardBody")}
      </InfoCard>
      <ActionButton url={`/api/shops/${shopId}/posts/generate`}>{t("status.fidelity.action")}</ActionButton>
      {/* No image download here: slides that failed the product check are not offered (FR-FD-01). */}
      <PostTools postId={postId} downloads={[]} canDelete />
      <ActivityPanel steps={steps} calls={calls} open />
    </StatusScreen>
  );
}

const SLIDE_LABELS = ["today.slide1", "today.slide2", "today.slide3"] as const;

// Studio (generate image post): the confirmed cutout, the three slides being built around it,
// and the live agent steps on one screen, so the owner watches the post take shape (F-24, NFR-17).
function Studio({ cutout, productName, steps, calls }: { cutout: string | null; productName: string | null; steps: Steps; calls: Calls }) {
  const done = steps.filter((s) => s.status === "succeeded" || s.status === "skipped").length;
  const running = steps.find((s) => s.status === "running");
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <AutoRefresh />
      <PageHeader eyebrow={t("studio.eyebrow")} title={t("status.generating.title")} body={t("studio.body")} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,616fr)_minmax(0,496fr)]">
        <section aria-label={t("studio.canvas")} className="flex flex-col gap-4 lg:glass lg:rounded-2xl lg:p-6">
          <figure className="glass flex items-center gap-4 rounded-card p-4">
            <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-control bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)]">
              {cutout && <Image src={cutout} alt={productName ?? ""} fill sizes="96px" className="object-contain" />}
            </div>
            <figcaption className="flex min-w-0 flex-col gap-1 leading-[1.4]">
              <span className="text-[10px] font-semibold text-muted uppercase">{t("studio.productEyebrow")}</span>
              <span className="text-lg font-semibold">{productName ?? t("studio.productPicked")}</span>
              <span className="text-sm text-muted">{t("studio.productBody")}</span>
            </figcaption>
          </figure>
          <ol className="grid grid-cols-3 gap-3" aria-busy="true">
            {SLIDE_LABELS.map((key, i) => (
              <li key={key} className="flex flex-col gap-2">
                <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-white">
                  <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,#e5f0ff,#f9f9ff_60%,#e5f0ff)]" style={{ animationDelay: `${i * 200}ms` }} />
                </div>
                <span className="text-xs font-semibold">{t(key)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-4">
          <div role="status" aria-live="polite" className="glass flex flex-col gap-1.5 rounded-card p-5 leading-[1.4]">
            <span className="text-[10px] font-semibold text-muted uppercase">{t("studio.now")}</span>
            <span className="text-lg font-semibold">
              {running ? stepLabel(running.step) : steps.length ? t("studio.nextStep") : t("studio.starting")}
            </span>
            <span className="text-sm text-muted">{t("studio.progress", { n: done })}</span>
          </div>
          <ActivityPanel steps={steps} calls={calls} open />
          <InfoCard vector="check" title={t("status.approvalTitle")}>
            {t("status.approvalBody")}
          </InfoCard>
        </section>
      </div>
    </div>
  );
}

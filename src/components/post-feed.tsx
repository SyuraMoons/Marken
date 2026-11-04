import Image from "next/image";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { ButtonLink } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { PostTools } from "@/components/post-tools";
import { StatusScreen } from "@/components/status-screen";
import { t, type MessageKey } from "@/lib/i18n";

// The fields the feed and calendar need from one post (a subset of HistoryItem).
export type FeedPost = {
  id: string;
  status: string;
  postDate: string;
  productName: string | null;
  caption: string;
  hashtags: string[];
  slideCount: number;
  thumb: string | null;
  /** Signed attachment URLs, only when every slide passed the product check (FR-FD-01). */
  downloads: string[];
  canDelete: boolean;
};

const STATUS: Record<string, { key: MessageKey; tone: string }> = {
  generating: { key: "history.status.generating", tone: "bg-powder text-blue" },
  ready: { key: "history.status.ready", tone: "bg-powder text-blue" },
  approved: { key: "history.status.approved", tone: "bg-powder text-blue" },
  publishing: { key: "history.status.publishing", tone: "bg-powder text-blue" },
  published: { key: "history.status.published", tone: "bg-white text-ink" },
  failed: { key: "history.status.failed", tone: "bg-white text-danger" },
  skipped: { key: "history.status.skipped", tone: "bg-white text-muted" },
};

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fmt = (ms: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en", { ...opts, timeZone: "UTC" }).format(ms);

function dayLabel(date: string, today: string) {
  const diff = Math.round((toMs(today) - toMs(date)) / DAY_MS);
  if (diff === 0) return t("history.today");
  if (diff === 1) return t("history.yesterday");
  if (diff > 1 && diff < 7) return t("feed.daysAgo", { n: diff });
  return fmt(toMs(date), { month: "short", day: "numeric", year: "numeric" });
}

const open = (id: string) => `/today?post=${id}`;

// History (Figma "Calendar addition" › today-feed frames): every post as a feed, newest first, beside a calendar
// of blurred previews. Each post opens its detail view on /today?post=<id>; Today itself shows only today's post.
export function PostFeed({
  shopName,
  today,
  posts,
  tab,
}: {
  shopName: string;
  /** The shop's local date, YYYY-MM-DD. */
  today: string;
  /** Newest first. */
  posts: FeedPost[];
  tab: "posts" | "calendar";
}) {
  if (!posts.length) {
    return (
      <StatusScreen title={t("history.emptyTitle")} body={t("history.emptyBody")}>
        <ButtonLink href="/create">{t("history.create")}</ButtonLink>
      </StatusScreen>
    );
  }

  const groups = new Map<string, FeedPost[]>();
  for (const p of posts) groups.set(p.postDate, [...(groups.get(p.postDate) ?? []), p]);
  const busy = posts.some((p) => p.status === "generating" || p.status === "publishing");

  return (
    <div className="flex flex-col gap-4 lg:gap-7">
      {busy && <AutoRefresh />}
      <header className="flex flex-col gap-1 leading-[1.4] lg:hidden">
        <p className="text-[11px] font-semibold text-muted uppercase">{t("feed.eyebrow")}</p>
        <h1 className="text-[28px] leading-[1.2] font-semibold">{t("feed.title")}</h1>
        <p className="text-[15px] text-muted">{t("feed.bodyShort")}</p>
      </header>
      <div className="max-lg:hidden">
        <PageHeader eyebrow={t("feed.eyebrow")} title={t("feed.title")} body={t("feed.body")} />
      </div>

      {/* Mobile switches between the two columns; desktop shows both side by side. */}
      <nav aria-label={t("feed.tabs")} className="grid grid-cols-2 gap-1 rounded-control bg-surface p-1 lg:hidden">
        {(["posts", "calendar"] as const).map((key) => (
          <Link
            key={key}
            href={key === "posts" ? "/posts" : "/posts?tab=calendar"}
            aria-current={tab === key ? "page" : undefined}
            replace
            scroll={false}
            className={`flex min-h-10 items-center justify-center rounded-[9px] text-sm focus-visible:outline-2 focus-visible:outline-blue ${tab === key ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgb(31_59_122/10%)]" : "font-medium text-muted"}`}
          >
            {t(key === "posts" ? "feed.tabPosts" : "feed.tabCalendar")}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,540fr)_minmax(0,572fr)]">
        <section aria-label={t("feed.tabPosts")} className={`flex flex-col gap-4 ${tab === "calendar" ? "max-lg:hidden" : ""}`}>
          {[...groups].map(([date, items]) => (
            <section key={date} aria-label={dayLabel(date, today)} className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-muted">{dayLabel(date, today)}</h2>
              {items.map((p) => (
                <FeedCard key={p.id} post={p} shopName={shopName} day={dayLabel(date, today)} />
              ))}
            </section>
          ))}
        </section>

        <PostCalendar today={today} posts={posts} className={`lg:sticky lg:top-6 ${tab === "calendar" ? "" : "max-lg:hidden"}`} />
      </div>
    </div>
  );
}

function FeedCard({ post, shopName, day }: { post: FeedPost; shopName: string; day: string }) {
  const status = STATUS[post.status] ?? STATUS.skipped;
  const making = post.status === "generating";
  return (
    <article data-tour="feed-post" className="glass flex flex-col gap-3.5 rounded-card p-5 leading-[1.4]">
      <header className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue text-sm font-semibold text-white">
          {(shopName.trim()[0] ?? "M").toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{shopName}</span>
          <span className="truncate text-xs text-muted">{post.productName ? t("feed.prepared", { day, product: post.productName }) : day}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-[3px] text-xs font-semibold ${status.tone}`}>{t(status.key)}</span>
      </header>

      <Link href={open(post.id)} aria-label={t("feed.open", { date: day })} className="relative block aspect-[4/5] overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
        {post.thumb ? (
          <Image src={post.thumb} alt="" fill sizes="(min-width: 1024px) 500px, 90vw" className="object-cover" />
        ) : (
          making && <span className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,#e5f0ff,#f9f9ff_60%,#e5f0ff)]" />
        )}
        {post.slideCount > 1 && (
          <span className="absolute top-3.5 right-3.5 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-semibold text-white">{t("feed.slides", { n: post.slideCount })}</span>
        )}
      </Link>

      {making ? (
        <p className="text-[15px] text-muted">{t("feed.generating")}</p>
      ) : (
        <>
          {post.productName && <p className="text-[11px] font-semibold text-muted uppercase">{post.productName}</p>}
          {post.caption && <p className="line-clamp-3 text-[15px] whitespace-pre-line">{post.caption}</p>}
          {post.hashtags.length > 0 && <p className="truncate text-[13px] text-blue">{post.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>}
        </>
      )}
      <ButtonLink href={open(post.id)} variant="secondary" className="h-12! text-[15px]! text-ink!">
        {t(making ? "feed.watch" : "feed.details")}
      </ButtonLink>
      {(post.downloads.length > 0 || post.canDelete) && <PostTools postId={post.id} downloads={post.downloads} canDelete={post.canDelete} compact />}
    </article>
  );
}

// Rolling five weeks ending with the current week (Sunday first), so today and the last month always show.
function PostCalendar({ today, posts, className = "" }: { today: string; posts: FeedPost[]; className?: string }) {
  const todayMs = toMs(today);
  const start = todayMs - (new Date(todayMs).getUTCDay() + 28) * DAY_MS;
  const end = start + 34 * DAY_MS;
  const byDay = new Map<string, FeedPost>();
  // Newest first, so the first post seen for a day is that day's latest.
  for (const p of posts) if (!byDay.has(p.postDate)) byDay.set(p.postDate, p);
  const inRange = posts.filter((p) => toMs(p.postDate) >= start && toMs(p.postDate) <= end).length;
  const weekdays = t("feed.weekdays").split(",");

  return (
    <section data-tour="calendar" aria-label={t("feed.calendarEyebrow")} className={`glass flex flex-col gap-3 rounded-card p-4 leading-[1.4] lg:gap-4 lg:p-6 ${className}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-muted uppercase max-lg:hidden">{t("feed.calendarEyebrow")}</span>
          <span className="text-base font-semibold lg:text-lg">
            {t("feed.calendarRange", { from: fmt(start, { month: "short", day: "numeric" }), to: fmt(end, { month: "short", day: "numeric", year: "numeric" }) })}
          </span>
        </div>
        <span className="text-[13px] font-medium text-muted max-lg:hidden">{t("feed.calendarCount", { n: inRange })}</span>
      </div>

      <ol className="grid grid-cols-7 gap-1.5 lg:gap-2">
        {weekdays.map((d) => (
          <li key={d} aria-hidden="true" className="text-center text-[11px] font-semibold text-muted">
            <span className="lg:hidden">{d[0]}</span>
            <span className="max-lg:hidden">{d}</span>
          </li>
        ))}
        {Array.from({ length: 35 }, (_, i) => {
          const ms = start + i * DAY_MS;
          const date = toDate(ms);
          const n = new Date(ms).getUTCDate();
          // The 1st also names its month on desktop, where cells are wide enough.
          const label = n === 1 ? (
            <>
              <span className="max-lg:hidden">{fmt(ms, { month: "short" })}&nbsp;</span>1
            </>
          ) : (
            String(n)
          );
          const long = fmt(ms, { weekday: "short", month: "short", day: "numeric" });
          const post = byDay.get(date);
          const isToday = ms === todayMs;
          const ring = isToday ? "ring-[2.5px] ring-blue ring-inset lg:ring-3" : "";
          const cell = "relative flex h-[58px] items-center justify-center overflow-hidden rounded-[10px] text-[13px] font-bold lg:aspect-[4/5] lg:h-auto lg:text-base";

          if (ms > todayMs) {
            return (
              <li key={date} aria-label={t("feed.calendarUpcoming", { date: long })} className={`${cell} border border-dashed border-border text-muted`}>
                {label}
              </li>
            );
          }
          if (!post) {
            return (
              <li key={date} aria-label={t("feed.calendarNoPost", { date: long })} className={`${cell} bg-surface text-muted ${ring}`}>
                {label}
              </li>
            );
          }
          const status = t((STATUS[post.status] ?? STATUS.skipped).key);
          return (
            <li key={date}>
              <Link
                href={open(post.id)}
                aria-label={`${long}${isToday ? `, ${t("feed.calendarToday")}` : ""}: ${status}`}
                className={`${cell} group bg-powder ${post.thumb ? "text-white" : "text-blue"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue`}
              >
                {post.thumb && <Image src={post.thumb} alt="" fill sizes="80px" className="scale-110 object-cover blur-[1.5px] transition-[filter] duration-200 group-hover:blur-none motion-reduce:transition-none" />}
                {/* No preview (still generating, or the product check failed): a light tile, so it never reads as selected. */}
                {post.thumb && <span aria-hidden="true" className="absolute inset-0 bg-ink/28 transition-opacity duration-200 group-hover:opacity-0 motion-reduce:transition-none" />}
                <span className={`relative ${post.thumb ? "[text-shadow:0_1px_2px_rgb(17_27_54/45%)] transition-opacity duration-200 group-hover:opacity-0 motion-reduce:transition-none" : ""}`}>{label}</span>
                {ring && <span aria-hidden="true" className={`absolute inset-0 rounded-[10px] ${ring}`} />}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-muted">
        <span className="lg:hidden">{t("feed.calendarHintShort")}</span>
        <span className="max-lg:hidden">{t("feed.calendarHint")}</span>
      </p>
    </section>
  );
}

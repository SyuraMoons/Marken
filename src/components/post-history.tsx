import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/button";
import { PageHeader } from "@/components/page-header";
import { PostTools } from "@/components/post-tools";
import { StatusScreen } from "@/components/status-screen";
import { t, type MessageKey } from "@/lib/i18n";
import type { HistoryItem } from "@/lib/data/today";

const STATUS: Record<string, { key: MessageKey; tone: string }> = {
  generating: { key: "history.status.generating", tone: "bg-powder text-blue" },
  ready: { key: "history.status.ready", tone: "bg-powder text-blue" },
  approved: { key: "history.status.approved", tone: "bg-powder text-blue" },
  publishing: { key: "history.status.publishing", tone: "bg-powder text-blue" },
  published: { key: "history.status.published", tone: "bg-white text-ink" },
  failed: { key: "history.status.failed", tone: "bg-white text-danger" },
  skipped: { key: "history.status.skipped", tone: "bg-white text-muted" },
};

function dayLabel(date: string, today: string) {
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const diff = Math.round((day(today) - day(date)) / 86_400_000);
  if (diff === 0) return t("history.today");
  if (diff === 1) return t("history.yesterday");
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(day(date));
}

// History (post list): grouped by day, newest first. Cards open the post on Today.
export function PostHistory({ items, today }: { items: HistoryItem[]; today: string }) {
  if (!items.length) {
    return (
      <StatusScreen title={t("history.emptyTitle")} body={t("history.emptyBody")}>
        <ButtonLink href="/create">{t("history.create")}</ButtonLink>
      </StatusScreen>
    );
  }

  const groups = new Map<string, HistoryItem[]>();
  for (const item of items) groups.set(item.postDate, [...(groups.get(item.postDate) ?? []), item]);

  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader eyebrow={t("history.eyebrow")} title={t("history.title")} body={t("history.body")} />
      {[...groups].map(([date, posts]) => (
        <section key={date} aria-label={dayLabel(date, today)} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">{dayLabel(date, today)}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {posts.map((p) => {
              const status = STATUS[p.status] ?? STATUS.skipped;
              return (
                <li key={p.id} className="glass flex flex-col gap-2 rounded-card p-2.5 leading-[1.4]">
                  <Link href={`/today?post=${p.id}`} className="flex flex-col gap-2 rounded-control focus-visible:outline-2 focus-visible:outline-blue">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-control bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)]">
                      {p.thumb && <Image src={p.thumb} alt="" fill sizes="(min-width: 1024px) 220px, 45vw" className="object-cover" />}
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>{t(status.key)}</span>
                    <span className="truncate text-sm font-semibold">{p.productName ?? t("history.noProduct")}</span>
                    {p.caption && <span className="line-clamp-2 text-xs text-muted">{p.caption}</span>}
                  </Link>
                  {(p.downloads.length > 0 || p.canDelete) && (
                    <PostTools postId={p.id} downloads={p.downloads} canDelete={p.canDelete} compact />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

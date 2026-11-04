import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PostFeed } from "@/components/post-feed";
import { shopToday } from "@/lib/api/owner";
import { getOwnerShop, getPostHistory } from "@/lib/data/today";

// History: every post Marken generated for the active shop as a feed plus a post calendar, so a post stays
// reachable after a newer run. Each card or calendar day opens the post on Today (?post=).
export default function PostsPage({ searchParams }: PageProps<"/posts">) {
  return (
    <Suspense fallback={<div className="aspect-[4/5] max-w-120 animate-pulse rounded-card bg-white" />}>
      <History searchParams={searchParams} />
    </Suspense>
  );
}

async function History({ searchParams }: Pick<PageProps<"/posts">, "searchParams">) {
  const [q, owner, items] = await Promise.all([searchParams, getOwnerShop(), getPostHistory()]);
  if (!owner || !items) redirect("/login");
  return <PostFeed shopName={owner.shop.name ?? ""} today={shopToday(owner.shop.time_zone)} posts={items} tab={q.tab === "calendar" ? "calendar" : "posts"} />;
}

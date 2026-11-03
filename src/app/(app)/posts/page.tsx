import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PostHistory } from "@/components/post-history";
import { shopToday } from "@/lib/api/owner";
import { getOwnerShop, getPostHistory } from "@/lib/data/today";

// History: every post Marken generated for the active shop, so a post stays reachable after a newer run
// replaces it on Today. Each card opens the post on Today (?post=).
export default function PostsPage() {
  return (
    <Suspense fallback={<div className="aspect-[4/5] max-w-120 animate-pulse rounded-card bg-white" />}>
      <History />
    </Suspense>
  );
}

async function History() {
  const [owner, items] = await Promise.all([getOwnerShop(), getPostHistory()]);
  if (!owner || !items) redirect("/login");
  return <PostHistory items={items} today={shopToday(owner.shop.time_zone)} />;
}

import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaptionEditor } from "@/components/caption-editor";
import { getOwnedPost } from "@/lib/api/owner";
import { signPath } from "@/lib/data/today";
import { asSlides } from "@/lib/posts/slides";
import { createClient } from "@/lib/supabase/server";

// Edit caption (F-11, FR-ED-01/02). Only a ready post can be edited.
export default function EditPostPage({ params, searchParams }: PageProps<"/posts/[id]/edit">) {
  return (
    <Suspense fallback={<div className="aspect-[4/5] max-w-120 animate-pulse rounded-card bg-white" />}>
      <Edit params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Edit({ params, searchParams }: Pick<PageProps<"/posts/[id]/edit">, "params" | "searchParams">) {
  const { id } = await params;
  const { c } = await searchParams;
  const guard = await getOwnedPost(id);
  if (!guard.ok || guard.value.status !== "ready") notFound();
  const post = guard.value;
  const slides = await Promise.all(
    asSlides(post.slides).map(async (s) => ({ ...s, slide_path: (await signPath(s.slide_path)) ?? "" })),
  );
  const captions = (post.caption_options as string[]) ?? [];
  const pick = Number(c);
  const initial = Number.isInteger(pick) && captions[pick] ? pick : 0;
  const product = post.product_id ? (await (await createClient()).from("products").select("name").eq("id", post.product_id).maybeSingle()).data : null;
  return <CaptionEditor postId={post.id} slides={slides} captions={captions} initial={initial} product={product?.name} />;
}

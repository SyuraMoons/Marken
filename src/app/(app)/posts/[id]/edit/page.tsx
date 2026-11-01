import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaptionEditor } from "@/components/caption-editor";
import { getOwnedPost } from "@/lib/api/owner";
import { signPath } from "@/lib/data/today";
import { asSlides } from "@/lib/posts/slides";

// Edit caption (F-11, FR-ED-01/02). Only a ready post can be edited.
export default function EditPostPage({ params }: PageProps<"/posts/[id]/edit">) {
  return (
    <Suspense fallback={<div className="aspect-[4/5] max-w-120 animate-pulse rounded-card bg-white" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/posts/[id]/edit">, "params">) {
  const { id } = await params;
  const guard = await getOwnedPost(id);
  if (!guard.ok || guard.value.status !== "ready") notFound();
  const post = guard.value;
  const slides = await Promise.all(
    asSlides(post.slides).map(async (s) => ({ ...s, slide_path: (await signPath(s.slide_path)) ?? "" })),
  );
  const captions = (post.caption_options as string[]) ?? [];
  return <CaptionEditor postId={post.id} slides={slides} captions={captions} hashtags={post.hashtags} />;
}

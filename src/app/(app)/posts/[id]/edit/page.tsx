import { Suspense } from "react";
import { CaptionEditor } from "@/components/caption-editor";
import { mockPost } from "@/lib/mock";
import { asSlides } from "@/lib/posts/slides";

// Edit caption (F-11, FR-ED-01/02). Mock captions until post reads land; the route :id goes to the API calls.
export default function EditPostPage({ params }: PageProps<"/posts/[id]/edit">) {
  return (
    <Suspense fallback={<div className="aspect-[4/5] max-w-120 animate-pulse rounded-card bg-white" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/posts/[id]/edit">, "params">) {
  const { id } = await params;
  return <CaptionEditor postId={id} slides={asSlides(mockPost.slides)} captions={(mockPost.caption_options as string[]) ?? []} hashtags={mockPost.hashtags} />;
}

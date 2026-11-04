// Which posts the owner may delete. Used by DELETE /api/posts/:id and by the screens that show the button.
// - ready, skipped: never published, nothing running.
// - failed: only when it was never approved (an approved post whose publish failed is still the owner's).
// - approved: only when Instagram is not connected. Then Approve queues no publish job and the owner
//   downloads the images by hand, so nothing needs the files. With Instagram connected a job may be queued.
// - generating, publishing, published: never (a job may write to it; Results depend on published posts).
export function canDeletePost(post: { status: string; approved_at: string | null }, igConnected: boolean) {
  switch (post.status) {
    case "ready":
    case "skipped":
      return true;
    case "failed":
      return !post.approved_at;
    case "approved":
      return !igConnected;
    default:
      return false;
  }
}

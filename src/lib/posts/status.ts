// Post status machine (SRD §7.2). Only `approved` may move to `publishing` (FR-TD-02).
export const POST_STATUSES = [
  "generating",
  "ready",
  "approved",
  "publishing",
  "published",
  "failed",
  "skipped",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

const TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  generating: ["ready", "failed"],
  ready: ["approved", "skipped"],
  approved: ["publishing"],
  publishing: ["published", "failed"],
  published: [],
  failed: ["generating", "approved"],
  skipped: [],
};

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  // Mirrors private.enforce_post_status(). A failed post may only return to approved
  // (retry publish) if it had been approved before; callers check approved_at.
  return TRANSITIONS[from].includes(to);
}

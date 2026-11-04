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
  ready: ["approved", "skipped", "generating"],
  approved: ["publishing"],
  publishing: ["published", "failed"],
  published: [],
  failed: ["generating", "publishing"],
  skipped: [],
};

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  // A failed post may only retry publishing if it had been approved; callers check that.
  return TRANSITIONS[from].includes(to);
}

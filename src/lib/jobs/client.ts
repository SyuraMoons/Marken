import "server-only";
import { Inngest } from "inngest";

// Inngest client and typed events shared by the API routes (issue #11) and the job
// functions (#12 generate/regenerate, #13 publish). Functions live in src/lib/jobs/index.ts.
export const inngest = new Inngest({ id: "marken" });

export type JobEvents = {
  "post/generate.requested": { shopId: string; postId: string; productId?: string };
  "post/publish.requested": { shopId: string; postId: string };
  "post/regenerate.requested": {
    shopId: string;
    postId: string;
    revisionId: string;
    target: "caption";
    feedback: string;
  };
};

export type JobName = keyof JobEvents;

/**
 * Sends one job event. `dedupeKey` becomes the Inngest event id, so a retried request
 * never starts the same job twice. Returns false when the send fails, so the route can
 * undo its own change and answer 503 instead of leaving work that will never run.
 */
export async function enqueue<N extends JobName>(
  name: N,
  data: JobEvents[N],
  dedupeKey: string,
): Promise<boolean> {
  try {
    await inngest.send({ id: `${name}:${dedupeKey}`, name, data });
    return true;
  } catch (error) {
    console.error("enqueue failed", name, error instanceof Error ? error.message : error);
    return false;
  }
}

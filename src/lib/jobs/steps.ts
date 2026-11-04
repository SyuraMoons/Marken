import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

// Wraps one pipeline step so it shows on the Activity Panel (FR-AP-01, NFR-17):
// a `running` row first, then `succeeded` or `failed` with the finish time. A retried
// attempt writes a fresh row, so every attempt stays visible.
export async function withStep<T>(
  ctx: { postId: string; shopId: string },
  step: string,
  model: string | null,
  fn: () => Promise<T>,
  detailOf?: (result: T) => Json,
): Promise<T> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("post_steps")
    .insert({ post_id: ctx.postId, shop_id: ctx.shopId, step, model, status: "running" })
    .select("id")
    .single();

  const finish = async (status: "succeeded" | "failed", detail: Json | null) => {
    if (!row) return;
    const { error } = await admin
      .from("post_steps")
      .update({ status, finished_at: new Date().toISOString(), detail })
      .eq("id", row.id);
    if (error) console.error("post_steps update failed", step, error.message);
  };

  try {
    const result = await fn();
    await finish("succeeded", detailOf ? detailOf(result) : null);
    return result;
  } catch (error) {
    await finish("failed", { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

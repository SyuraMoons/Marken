import { z } from "zod";
import { getOwnedShop } from "@/lib/api/owner";
import { apiError, parseJson } from "@/lib/http";
import { listShops, setActiveShop } from "@/lib/supabase/active-shop";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Delete an organization (shop) and all its media (NFR-14). Row deletes cascade through the schema,
// but Storage files do not, so they are removed first. If a file delete fails the shop
// row stays, and the owner can simply retry.
// `publish` holds the JPEG copies made for Instagram, so it must go too.
const FOLDERS = ["uploads", "cutouts", "scenes", "slides", "publish"] as const;
const PAGE = 100;

const Body = z.object({ confirm: z.literal(true) });

export async function DELETE(req: Request, ctx: RouteContext<"/api/shops/[id]">) {
  const { id } = await ctx.params;
  const guard = await getOwnedShop(id);
  if (!guard.ok) return guard.response;
  const shop = guard.value;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;

  const admin = createAdminClient();
  const bucket = admin.storage.from("media");

  for (const folder of FOLDERS) {
    const prefix = `${shop.id}/${folder}`;
    // Always list from the start: removed files drop out of the listing.
    for (;;) {
      const { data: files, error } = await bucket.list(prefix, { limit: PAGE });
      if (error) return apiError("media_delete_failed", 500);
      if (!files?.length) break;
      const removed = await bucket.remove(files.map((f) => `${prefix}/${f.name}`));
      if (removed.error) return apiError("media_delete_failed", 500);
      if (files.length < PAGE) break;
    }
  }

  const { error } = await admin.from("shops").delete().eq("id", shop.id);
  if (error) return apiError("shop_delete_failed", 500);

  // An owner may have other organizations (SRD v2.1 A-12). Deleting the active one clears the
  // pointer, so point it at a finished organization if there is one, else whatever is left.
  const supabase = await createClient();
  const left = await listShops(supabase, guard.user.id);
  const next = left.shops.find((s) => s.onboarding_completed_at) ?? left.shops[0] ?? null;
  if (next) await setActiveShop(supabase, guard.user.id, next.id);

  return Response.json({ deleted: true, next: next ? { id: next.id, name: next.name ?? "" } : null });
}

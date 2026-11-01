import { z } from "zod";
import { getOwnedShop } from "@/lib/api/owner";
import { apiError, parseJson } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

// Delete the shop and all its media (NFR-14). Row deletes cascade through the schema,
// but Storage files do not, so they are removed first. If a file delete fails the shop
// row stays, and the owner can simply retry.
const FOLDERS = ["uploads", "cutouts", "scenes", "slides"] as const;
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

  return Response.json({ deleted: true });
}

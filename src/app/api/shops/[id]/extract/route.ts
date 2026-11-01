import { z } from "zod";
import { getOwnedShop } from "@/lib/api/owner";
import { apiError, parseJson } from "@/lib/http";
import { extractProductsAndCutouts } from "@/lib/agents";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

// Run product extraction and SAM 3.1 cutout over the uploaded photos (F-04, FR-SP-01/02/09).
// Synchronous on purpose: 3-10 photos finish well under the function limit and step 3
// needs the products straight away.
export const maxDuration = 120;

const Body = z.object({
  uploadIds: z.array(z.uuid()).min(1).max(10),
});

const SIGNED_URL_TTL_S = 60 * 60;

export async function POST(req: Request, ctx: RouteContext<"/api/shops/[id]/extract">) {
  const { id } = await ctx.params;
  const guard = await getOwnedShop(id);
  if (!guard.ok) return guard.response;
  const shop = guard.value;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const uploadIds = [...new Set(parsed.data.uploadIds)];

  const admin = createAdminClient();

  // Only this shop's uploads count; an id from elsewhere is simply not found.
  const { data: uploads } = await admin
    .from("media_uploads")
    .select("id, storage_path")
    .eq("shop_id", shop.id)
    .in("id", uploadIds);
  if (!uploads || uploads.length !== uploadIds.length) {
    return apiError("upload_not_found", 404);
  }

  // A retry skips photos that already became a product, so it costs nothing.
  const { data: existing } = await admin
    .from("products")
    .select("source_upload_id")
    .eq("shop_id", shop.id)
    .in("source_upload_id", uploadIds);
  const done = new Set((existing ?? []).map((p) => p.source_upload_id));
  const pending = uploads.filter((u) => !done.has(u.id));

  const failures: { uploadId: string }[] = [];

  if (pending.length) {
    const photos: { photo: Buffer; sourcePhotoId: string }[] = [];
    for (const upload of pending) {
      const file = await admin.storage.from("media").download(upload.storage_path);
      if (file.error || !file.data) {
        console.error("extract: download failed", upload.id);
        failures.push({ uploadId: upload.id });
        continue;
      }
      photos.push({
        photo: Buffer.from(await file.data.arrayBuffer()),
        sourcePhotoId: upload.id,
      });
    }

    const result = photos.length
      ? await extractProductsAndCutouts({
          photos,
          shopId: shop.id,
          contentLanguage: shop.content_language === "id" ? "id" : "en",
        })
      : { items: [], failures: [] };

    for (const failure of result.failures) {
      console.error("extract: photo failed", failure.sourcePhotoId, failure.error);
      failures.push({ uploadId: failure.sourcePhotoId });
    }

    for (const item of result.items) {
      const uploadId = item.product.source_photo;
      const cutoutPath = `${shop.id}/cutouts/${uploadId}.png`;
      const stored = await admin.storage
        .from("media")
        .upload(cutoutPath, item.cutout.cutoutBuffer, {
          contentType: "image/png",
          upsert: true,
        });
      if (stored.error) {
        console.error("extract: cutout upload failed", uploadId, stored.error.message);
        failures.push({ uploadId });
        continue;
      }
      const { error } = await admin.from("products").upsert(
        {
          shop_id: shop.id,
          name: item.product.name,
          category: item.product.category,
          price: item.product.price,
          currency: item.product.currency,
          attributes: item.product.attributes as unknown as Json,
          description: item.product.description,
          source_upload_id: uploadId,
          cutout_path: cutoutPath,
          cutout_confirmed: false,
        },
        { onConflict: "source_upload_id", ignoreDuplicates: true },
      );
      if (error) {
        console.error("extract: product insert failed", uploadId, error.message);
        failures.push({ uploadId });
      }
    }

    if (failures.length === pending.length) {
      return apiError("extraction_failed", 502, { failures });
    }
  }

  const { data: products, error } = await admin
    .from("products")
    .select("*")
    .eq("shop_id", shop.id)
    .in("source_upload_id", uploadIds)
    .order("created_at");
  if (error) return apiError("products_failed", 500);

  const paths = (products ?? []).flatMap((p) => (p.cutout_path ? [p.cutout_path] : []));
  const signed = paths.length
    ? await admin.storage.from("media").createSignedUrls(paths, SIGNED_URL_TTL_S)
    : { data: [] };
  const urlByPath = new Map(
    (signed.data ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])),
  );

  return Response.json({
    products: (products ?? []).map((p) => ({
      ...p,
      cutout_url: p.cutout_path ? (urlByPath.get(p.cutout_path) ?? null) : null,
    })),
    failures,
  });
}

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { apiError, conflict, parseJson, unauthorized } from "@/lib/http";

// Signed upload URL for product media (NFR-13). The browser uploads straight to Storage,
// because Vercel rejects request bodies over 4.5 MB and phone photos are often larger.
// The bucket itself enforces type and size again.

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_UPLOADS_PER_SHOP = 30;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const Body = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  bytes: z.number().int().positive().max(MAX_BYTES),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { mimeType, bytes } = parsed.data;

  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!shop) return conflict("no_shop");

  const { count } = await supabase
    .from("media_uploads")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id);
  if ((count ?? 0) >= MAX_UPLOADS_PER_SHOP) return apiError("too_many_uploads", 429);

  const admin = createAdminClient();
  // The path is built here, never taken from the client.
  const path = `${shop.id}/uploads/${randomUUID()}.${EXT[mimeType]}`;

  const signed = await admin.storage.from("media").createSignedUploadUrl(path);
  if (signed.error || !signed.data) return apiError("sign_failed", 500);

  const { data: row, error } = await admin
    .from("media_uploads")
    .insert({ shop_id: shop.id, storage_path: path, bytes, mime_type: mimeType })
    .select("id")
    .single();
  if (error || !row) return apiError("upload_record_failed", 500);

  return Response.json(
    {
      uploadId: row.id,
      path,
      token: signed.data.token,
      signedUrl: signed.data.signedUrl,
    },
    { status: 201 },
  );
}

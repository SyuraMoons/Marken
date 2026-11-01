import { createClient } from "@/lib/supabase/client";

// Browser -> Storage straight through a signed upload URL (NFR-13); then extraction + cutout (F-04).
export const ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_BYTES = 10 * 1024 * 1024;

export type Extracted = { products: { id: string }[]; failures: { uploadId: string }[] };

export function validPhoto(file: File) {
  return ACCEPT.split(",").includes(file.type) && file.size > 0 && file.size <= MAX_BYTES;
}

async function uploadOne(file: File) {
  const res = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType: file.type, bytes: file.size }),
  });
  if (!res.ok) throw new Error("sign_failed");
  const { uploadId, path, token } = (await res.json()) as { uploadId: string; path: string; token: string };
  const { error } = await createClient().storage.from("media").uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) throw new Error("upload_failed");
  return uploadId;
}

export async function uploadAndExtract(shopId: string, files: File[]): Promise<Extracted> {
  const uploadIds: string[] = [];
  for (const file of files) uploadIds.push(await uploadOne(file));
  const res = await fetch(`/api/shops/${shopId}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadIds }),
  });
  if (!res.ok) throw new Error("extract_failed");
  return (await res.json()) as Extracted;
}

export async function patchOnboarding(shopId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/shops/${shopId}/onboarding`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return Boolean(res?.ok);
}

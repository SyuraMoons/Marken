// Single entry point for uploaded product photos. Decodes once and bakes in EXIF
// orientation, so extraction, SAM 3.1 and the cutout all see the same upright pixels.

import sharp from "sharp";

const PHOTO_FETCH_TIMEOUT_MS = 15_000;

/**
 * Raw image bytes (`Buffer` / `Uint8Array`), base64 string, `data:image/...;base64,...` URI,
 * or an HTTP(S) signed URL.
 */
export type PhotoSource = Buffer | Uint8Array | string;

export type NormalizedPhoto = {
  /** Lossless, full-resolution source for product pixels. */
  uprightPng: Buffer;
  width: number;
  height: number;
};

export type PhotoInput = PhotoSource | NormalizedPhoto;

function isNormalizedPhoto(photo: PhotoInput): photo is NormalizedPhoto {
  return typeof photo === "object" && "uprightPng" in photo;
}

async function readPhotoBytes(photo: PhotoSource): Promise<Buffer> {
  if (typeof photo !== "string") {
    return Buffer.from(photo);
  }

  const trimmed = photo.trim();
  if (trimmed.startsWith("data:image/")) {
    return Buffer.from(trimmed.split(",")[1] ?? "", "base64");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const res = await fetch(trimmed, {
      signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      // The URL is a signed bearer link, so it must stay out of errors and logs (NFR-12/13)
      throw new Error(`Failed to fetch product photo (HTTP ${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  return Buffer.from(trimmed, "base64");
}

/**
 * Resolves any photo source to upright pixels. Already normalized photos pass through,
 * so a batch can decode once and hand the result to every step.
 */
export async function normalizePhoto(
  photo: PhotoInput,
): Promise<NormalizedPhoto> {
  if (isNormalizedPhoto(photo)) {
    return photo;
  }

  const { data, info } = await sharp(await readPhotoBytes(photo))
    .autoOrient()
    .png({ compressionLevel: 1 })
    .toBuffer({ resolveWithObject: true });

  return { uprightPng: data, width: info.width, height: info.height };
}

/**
 * Bounded JPEG data URL for a model request, so request size stays small whatever
 * resolution the owner uploaded.
 */
export async function photoToModelDataUrl(
  photo: NormalizedPhoto,
  maxSide: number,
): Promise<string> {
  const jpeg = await sharp(photo.uprightPng)
    .resize({
      width: maxSide,
      height: maxSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 85 })
    .toBuffer();

  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

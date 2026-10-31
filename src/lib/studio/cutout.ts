// Pillar 1 — Product Cutout Service (FR-SP-09, F-09).
// Calls `sam-3.1` through the Single Model Gateway, decodes the binary segmentation
// mask via Meta's official `@meta-sam/parser`, and returns a transparent RGBA PNG buffer
// ready for deterministic compositing.

import { decodeMaskToRaster } from "@meta-sam/parser";
import sharp from "sharp";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";

export type NormalizedBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CutoutProductInput = {
  /**
   * Raw image bytes (`Buffer` / `Uint8Array`), base64 string, `data:image/...;base64,...` URI,
   * or an HTTP(S) signed URL.
   */
  photo: Buffer | Uint8Array | string;
  /**
   * Optional text hint for `sam-3.1` segmentation (e.g. "ceramic mug", "leather bag").
   * Defaults to "main product".
   */
  labelHint?: string;
  shopId?: string;
  postId?: string;
};

export type CutoutProductResult = {
  /**
   * Transparent PNG (`RGBA`, 4 channels) cropped tightly around the segmented product.
   */
  cutoutBuffer: Buffer;
  /**
   * `data:image/png;base64,...` representation for immediate preview or multimodal pass.
   */
  cutoutDataUrl: string;
  /**
   * Normalized `[0..1]` bounding box of the product relative to the original photo.
   */
  bbox: NormalizedBBox;
  /**
   * Width of the resulting `cutoutBuffer` in pixels.
   */
  width: number;
  /**
   * Height of the resulting `cutoutBuffer` in pixels.
   */
  height: number;
  /**
   * Segmentation confidence `[0..1]`.
   */
  confidence: number;
  /**
   * Gateway telemetry record (`step: "cutout"`, `model: "sam-3.1"`).
   */
  telemetry: ModelCallTelemetry;
};

type SamGatewayOutput = {
  cutoutBase64?: string | null;
  rawSegmentationText?: string;
  maskData?: string | null;
  pixelBox?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } | null;
  bbox?: NormalizedBBox;
  confidence?: number;
};

/**
 * Decodes `sam-3.1` `<|mask;x=...;y=...;data=<height>,<width>,<payload>|>` using
 * `@meta-sam/parser`'s official `decodeMaskToRaster` into a `0 | 255` alpha `Buffer`.
 */
export function decodeSamMaskToAlphaBuffer(maskData: string): {
  alpha: Buffer;
  width: number;
  height: number;
} | null {
  try {
    const firstComma = maskData.indexOf(",");
    const secondComma = maskData.indexOf(",", firstComma + 1);
    if (firstComma === -1 || secondComma === -1) return null;

    const height = Number(maskData.slice(0, firstComma));
    const width = Number(maskData.slice(firstComma + 1, secondComma));
    const payload = maskData.slice(secondComma + 1).trim();

    if (
      !Number.isSafeInteger(height) ||
      !Number.isSafeInteger(width) ||
      height <= 0 ||
      width <= 0 ||
      !payload
    ) {
      return null;
    }

    const encoding = payload.startsWith("~")
      ? "lossless"
      : payload.startsWith("!")
        ? "one_bit"
        : null;
    if (!encoding) return null;

    const raster01 = decodeMaskToRaster({
      encoding,
      payload,
      width,
      height,
    });

    const alpha = Buffer.allocUnsafe(raster01.length);
    for (let i = 0; i < raster01.length; i++) {
      alpha[i] = raster01[i] ? 255 : 0;
    }

    return { alpha, width, height };
  } catch {
    return null;
  }
}

async function resolvePhotoInput(photo: Buffer | Uint8Array | string): Promise<{
  photoBuffer: Buffer;
  dataUrl: string;
}> {
  if (Buffer.isBuffer(photo)) {
    const pngBuf = await sharp(photo).png().toBuffer();
    return {
      photoBuffer: pngBuf,
      dataUrl: `data:image/png;base64,${pngBuf.toString("base64")}`,
    };
  }

  if (photo instanceof Uint8Array) {
    const pngBuf = await sharp(Buffer.from(photo)).png().toBuffer();
    return {
      photoBuffer: pngBuf,
      dataUrl: `data:image/png;base64,${pngBuf.toString("base64")}`,
    };
  }

  const trimmed = photo.trim();
  if (trimmed.startsWith("data:image/")) {
    const base64Part = trimmed.split(",")[1] ?? "";
    const buf = Buffer.from(base64Part, "base64");
    const pngBuf = await sharp(buf).png().toBuffer();
    return {
      photoBuffer: pngBuf,
      dataUrl: `data:image/png;base64,${pngBuf.toString("base64")}`,
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const res = await fetch(trimmed);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch product photo from URL (${res.status}): ${trimmed}`,
      );
    }
    const arrayBuf = await res.arrayBuffer();
    const pngBuf = await sharp(Buffer.from(arrayBuf)).png().toBuffer();
    return {
      photoBuffer: pngBuf,
      dataUrl: `data:image/png;base64,${pngBuf.toString("base64")}`,
    };
  }

  // Assume raw base64 string
  const buf = Buffer.from(trimmed, "base64");
  const pngBuf = await sharp(buf).png().toBuffer();
  return {
    photoBuffer: pngBuf,
    dataUrl: `data:image/png;base64,${pngBuf.toString("base64")}`,
  };
}

/**
 * Cuts out the main product from an uploaded photo using `SAM 3.1` via the Single Model Gateway
 * and returns a transparent RGBA PNG buffer (`FR-SP-09`).
 */
export async function cutoutProduct(
  input: CutoutProductInput,
): Promise<CutoutProductResult> {
  const { photoBuffer, dataUrl } = await resolvePhotoInput(input.photo);
  const metadata = await sharp(photoBuffer).metadata();
  const origWidth = metadata.width ?? 800;
  const origHeight = metadata.height ?? 800;

  const { data: samOut, telemetry } = await callModelWithTelemetry<
    { imageUrl: string; labelHint: string },
    SamGatewayOutput
  >({
    step: "cutout",
    model: "sam-3.1",
    shopId: input.shopId,
    postId: input.postId,
    input: {
      imageUrl: dataUrl,
      labelHint: input.labelHint?.trim() || "main product",
    },
  });

  // Fast path: if mock provider returned a pre-rendered PNG base64
  if (samOut.cutoutBase64) {
    const rawBuf = Buffer.from(samOut.cutoutBase64, "base64");
    const cutoutBuffer = await sharp(rawBuf).ensureAlpha().png().toBuffer();
    const cutMeta = await sharp(cutoutBuffer).metadata();
    return {
      cutoutBuffer,
      cutoutDataUrl: `data:image/png;base64,${cutoutBuffer.toString("base64")}`,
      bbox: samOut.bbox ?? { x: 0.15, y: 0.15, width: 0.7, height: 0.7 },
      width: cutMeta.width ?? origWidth,
      height: cutMeta.height ?? origHeight,
      confidence: samOut.confidence ?? 0.98,
      telemetry,
    };
  }

  // Determine pixel crop box from SAM 3.1 `<|box;x1=...;y1=...;x2=...;y2=...;w=...;h=|>`
  const bbox: NormalizedBBox = samOut.bbox ?? {
    x: 0.15,
    y: 0.15,
    width: 0.7,
    height: 0.7,
  };

  let cropLeft: number;
  let cropTop: number;
  let cropWidth: number;
  let cropHeight: number;

  if (samOut.pixelBox) {
    const scaleX = origWidth / Math.max(1, samOut.pixelBox.w);
    const scaleY = origHeight / Math.max(1, samOut.pixelBox.h);
    cropLeft = Math.max(0, Math.round(samOut.pixelBox.x1 * scaleX));
    cropTop = Math.max(0, Math.round(samOut.pixelBox.y1 * scaleY));
    const right = Math.min(
      origWidth,
      Math.round((samOut.pixelBox.x2 + 1) * scaleX),
    );
    const bottom = Math.min(
      origHeight,
      Math.round((samOut.pixelBox.y2 + 1) * scaleY),
    );
    cropWidth = Math.max(1, right - cropLeft);
    cropHeight = Math.max(1, bottom - cropTop);
  } else {
    cropLeft = Math.max(0, Math.round(bbox.x * origWidth));
    cropTop = Math.max(0, Math.round(bbox.y * origHeight));
    cropWidth = Math.max(
      1,
      Math.min(origWidth - cropLeft, Math.round(bbox.width * origWidth)),
    );
    cropHeight = Math.max(
      1,
      Math.min(origHeight - cropTop, Math.round(bbox.height * origHeight)),
    );
  }

  // Extract RGB pixels of the bounding box crop (3 channels)
  const croppedRgbBuffer = await sharp(photoBuffer)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })
    .removeAlpha()
    .raw()
    .toBuffer();

  // Decode SAM 3.1 mask via `@meta-sam/parser`
  let alphaChannel: Buffer | null = null;
  if (samOut.maskData) {
    const decoded = decodeSamMaskToAlphaBuffer(samOut.maskData);
    if (decoded) {
      if (decoded.width === cropWidth && decoded.height === cropHeight) {
        alphaChannel = decoded.alpha;
      } else {
        alphaChannel = await sharp(decoded.alpha, {
          raw: {
            width: decoded.width,
            height: decoded.height,
            channels: 1,
          },
        })
          .resize(cropWidth, cropHeight, { fit: "fill" })
          .raw()
          .toBuffer();
      }
    }
  }

  // Fallback alpha mask if maskData was absent
  if (!alphaChannel || alphaChannel.length !== cropWidth * cropHeight) {
    alphaChannel = Buffer.alloc(cropWidth * cropHeight, 255);
  }

  // Combine 3-channel RGB crop + 1-channel Alpha mask into transparent RGBA PNG
  const cutoutBuffer = await sharp(croppedRgbBuffer, {
    raw: { width: cropWidth, height: cropHeight, channels: 3 },
  })
    .joinChannel(alphaChannel, {
      raw: { width: cropWidth, height: cropHeight, channels: 1 },
    })
    .png()
    .toBuffer();

  return {
    cutoutBuffer,
    cutoutDataUrl: `data:image/png;base64,${cutoutBuffer.toString("base64")}`,
    bbox,
    width: cropWidth,
    height: cropHeight,
    confidence: samOut.confidence ?? 0.98,
    telemetry,
  };
}

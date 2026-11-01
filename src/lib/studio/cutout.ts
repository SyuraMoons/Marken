// Pillar 1 — Product Cutout Service (FR-SP-09, F-09).
// Calls `sam-3.1` through the Single Model Gateway, decodes the binary segmentation
// mask via Meta's official `@meta-sam/parser`, and returns a transparent RGBA PNG buffer
// ready for deterministic compositing.

import { decodeMaskToRaster, type SegmentationMask } from "@meta-sam/parser";
import sharp from "sharp";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import { normalizePhoto, photoToModelDataUrl, type PhotoInput } from "./photo";

// Larger than the extraction image: the mask is upscaled onto full-resolution pixels,
// so this sets how clean the cutout edge is.
const SAM_INPUT_MAX_SIDE = 2048;

export type NormalizedBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CutoutProductInput = {
  photo: PhotoInput;
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
   * Segmentation confidence `[0..1]` from `sam-3.1`, or `null` when it did not report one.
   */
  confidence: number | null;
  /**
   * Gateway telemetry record (`step: "cutout"`, `model: "sam-3.1"`).
   */
  telemetry: ModelCallTelemetry;
};

type SamGatewayOutput = {
  cutoutBase64?: string | null;
  rawSegmentationText?: string;
  mask?: SegmentationMask | null;
  pixelBox?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } | null;
  bbox?: NormalizedBBox | null;
  confidence?: number | null;
  issue?: string | null;
};

/**
 * Thrown when `sam-3.1` gives no usable segmentation. A plain crop would keep the
 * background and pass as a real cutout, so the step fails visibly instead (`FR-SP-09`).
 * Carries the telemetry because the call was still made and paid for.
 */
export class CutoutFailedError extends Error {
  readonly telemetry: ModelCallTelemetry;

  constructor(reason: string, telemetry: ModelCallTelemetry) {
    super(`Product cutout failed: ${reason}`);
    this.name = "CutoutFailedError";
    this.telemetry = telemetry;
  }
}

/**
 * Cleans up small specular-highlight holes and 1-2px gaps inside a binary `0 | 1` mask
 * via morphological dilation -> border flood-fill (hole filling).
 */
function fillMaskHolesAndSpeckles(
  raster01: Uint8Array,
  width: number,
  height: number,
): Buffer {
  const total = width * height;
  const closed = new Uint8Array(raster01);

  const radius = 2;
  const dilated = new Uint8Array(total);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (closed[y * width + x]) {
        const yMin = Math.max(0, y - radius);
        const yMax = Math.min(height - 1, y + radius);
        const xMin = Math.max(0, x - radius);
        const xMax = Math.min(width - 1, x + radius);
        for (let ny = yMin; ny <= yMax; ny++) {
          const rowOff = ny * width;
          for (let nx = xMin; nx <= xMax; nx++) {
            dilated[rowOff + nx] = 1;
          }
        }
      }
    }
  }

  const exterior = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const enqueueIfZero = (idx: number) => {
    if (!dilated[idx] && !exterior[idx]) {
      exterior[idx] = 1;
      queue[tail++] = idx;
    }
  };

  const cornerSpanX = Math.max(4, Math.round(width * 0.18));
  for (let x = 0; x < width; x++) {
    if (x < cornerSpanX || x >= width - cornerSpanX) {
      enqueueIfZero(x);
      enqueueIfZero((height - 1) * width + x);
    }
  }
  for (let y = 0; y < height; y++) {
    enqueueIfZero(y * width);
    enqueueIfZero(y * width + (width - 1));
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) enqueueIfZero(idx - 1);
    if (x + 1 < width) enqueueIfZero(idx + 1);
    if (y > 0) enqueueIfZero(idx - width);
    if (y + 1 < height) enqueueIfZero(idx + width);
  }

  const alpha = Buffer.allocUnsafe(total);
  for (let i = 0; i < total; i++) {
    alpha[i] = exterior[i] ? 0 : 255;
  }
  return alpha;
}

/**
 * Decodes a `sam-3.1` mask into a `0 | 255` alpha `Buffer`. Returns `null` for an empty mask.
 */
function maskToAlpha(mask: SegmentationMask): Buffer | null {
  const raster01 = decodeMaskToRaster(mask);
  let foreground = false;
  for (let i = 0; i < raster01.length; i++) {
    if (raster01[i] !== 0) {
      foreground = true;
      break;
    }
  }
  if (!foreground) return null;
  return fillMaskHolesAndSpeckles(raster01, mask.width, mask.height);
}

/**
 * Cuts out the main product from an uploaded photo using `SAM 3.1` via the Single Model Gateway
 * and returns a transparent RGBA PNG buffer (`FR-SP-09`).
 */
export async function cutoutProduct(
  input: CutoutProductInput,
): Promise<CutoutProductResult> {
  const photo = await normalizePhoto(input.photo);
  const dataUrl = await photoToModelDataUrl(photo, SAM_INPUT_MAX_SIDE);
  const { uprightPng, width: origWidth, height: origHeight } = photo;

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
  if (samOut.cutoutBase64 && samOut.bbox) {
    const rawBuf = Buffer.from(samOut.cutoutBase64, "base64");
    const cutoutBuffer = await sharp(rawBuf).ensureAlpha().png().toBuffer();
    const cutMeta = await sharp(cutoutBuffer).metadata();
    return {
      cutoutBuffer,
      cutoutDataUrl: `data:image/png;base64,${cutoutBuffer.toString("base64")}`,
      bbox: samOut.bbox,
      width: cutMeta.width ?? origWidth,
      height: cutMeta.height ?? origHeight,
      confidence: samOut.confidence ?? null,
      telemetry,
    };
  }

  const { mask, pixelBox, bbox } = samOut;
  if (!mask || !pixelBox || !bbox) {
    throw new CutoutFailedError(
      samOut.issue ?? "sam-3.1 returned no segmentation",
      telemetry,
    );
  }

  const decodedAlpha = maskToAlpha(mask);
  if (!decodedAlpha) {
    throw new CutoutFailedError("sam-3.1 returned an empty mask", telemetry);
  }

  // Scale SAM 3.1 `<|box;x1=...;y1=...;x2=...;y2=...;w=...;h=...|>` onto the full-size photo
  const scaleX = origWidth / Math.max(1, pixelBox.w);
  const scaleY = origHeight / Math.max(1, pixelBox.h);
  const cropLeft = Math.max(0, Math.round(pixelBox.x1 * scaleX));
  const cropTop = Math.max(0, Math.round(pixelBox.y1 * scaleY));
  const right = Math.min(origWidth, Math.round((pixelBox.x2 + 1) * scaleX));
  const bottom = Math.min(origHeight, Math.round((pixelBox.y2 + 1) * scaleY));
  const cropWidth = Math.max(1, right - cropLeft);
  const cropHeight = Math.max(1, bottom - cropTop);

  // Extract RGB pixels of the bounding box crop (3 channels)
  const croppedRgbBuffer = await sharp(uprightPng)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropWidth,
      height: cropHeight,
    })
    .removeAlpha()
    .raw()
    .toBuffer();

  // The mask covers the box exactly, at its own resolution
  const alphaChannel =
    mask.width === cropWidth && mask.height === cropHeight
      ? decodedAlpha
      : await sharp(decodedAlpha, {
          raw: { width: mask.width, height: mask.height, channels: 1 },
        })
          .resize(cropWidth, cropHeight, { fit: "fill" })
          .raw()
          .toBuffer();

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
    confidence: samOut.confidence ?? null,
    telemetry,
  };
}

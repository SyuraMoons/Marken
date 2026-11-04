// Pillar 1 — Product Cutout Service (FR-SP-09, F-09).
// Calls `sam-3.1` through the Single Model Gateway, decodes the binary segmentation
// mask via Meta's official `@meta-sam/parser`, and returns a transparent RGBA PNG buffer
// ready for deterministic compositing.

import { decodeMaskToRaster, type SegmentationMask } from "@meta-sam/parser";
import sharp from "sharp";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import {
  assessCutout,
  CUTOUT_REASON_HINTS,
  type CutoutAssessment,
  type CutoutReasonCode,
} from "./cutout-quality";
import {
  decontaminateEdges,
  rasterToSoftAlpha,
  refineMaskRaster,
} from "./mask-refine";
import { normalizePhoto, photoToModelDataUrl, type PhotoInput } from "./photo";

// Larger than the extraction image: the mask is upscaled onto full-resolution pixels,
// so this sets how clean the cutout edge is.
const SAM_INPUT_MAX_SIDE = 2048;
/** Longest side of the stored cutout PNG; keeps it well under the 10 MB media bucket limit. */
const CUTOUT_MAX_SIDE = 2048;

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
   * Quality gate result for the cutout mask (`null` on the pre-rendered mock path).
   */
  quality: CutoutAssessment | null;
  /**
   * Gateway telemetry record (`step: "cutout"`, `model: "sam-3.1"`). Cost, latency and
   * image count are summed when the cutout was retried.
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
  /** Quality gate failures, when the mask was found but rejected. Empty otherwise. */
  readonly reasons: CutoutReasonCode[];

  constructor(
    reason: string,
    telemetry: ModelCallTelemetry,
    reasons: CutoutReasonCode[] = [],
  ) {
    super(`Product cutout failed: ${reason}`);
    this.name = "CutoutFailedError";
    this.telemetry = telemetry;
    this.reasons = reasons;
  }

  /** Owner-facing tips for the quality failures, to show next to the re-upload prompt. */
  get hints(): string[] {
    return this.reasons.map((code) => CUTOUT_REASON_HINTS[code]);
  }
}

/**
 * Prompts tried in order. The caller's hint only: `extract.ts` already retries with its own
 * concrete hints (labelHint, segment phrase, name), and generic words like "product" return
 * an empty answer from SAM 3.1, so a second loop here would only add paid calls.
 */
const FALLBACK_HINTS: string[] = [];
const MAX_ATTEMPTS = 1;

function mergeTelemetry(list: ModelCallTelemetry[]): ModelCallTelemetry {
  const last = list[list.length - 1];
  if (list.length === 1) return last;
  return {
    ...last,
    images: list.reduce((n, t) => n + t.images, 0),
    tokensIn: list.reduce((n, t) => n + t.tokensIn, 0),
    tokensOut: list.reduce((n, t) => n + t.tokensOut, 0),
    latencyMs: list.reduce((n, t) => n + t.latencyMs, 0),
    costUsd: Number(list.reduce((n, t) => n + t.costUsd, 0).toFixed(6)),
    retries: list.length - 1,
  };
}

/**
 * Cuts out the main product from an uploaded photo using `SAM 3.1` via the Single Model Gateway
 * and returns a transparent RGBA PNG buffer (`FR-SP-09`).
 *
 * The mask is cleaned (speckles, small holes), turned into a soft anti-aliased alpha, and
 * the edge colours are decontaminated. A quality gate rejects unusable masks; one retry runs
 * with a generic prompt before the step fails visibly with the gate's reasons.
 */
export async function cutoutProduct(
  input: CutoutProductInput,
): Promise<CutoutProductResult> {
  const photo = await normalizePhoto(input.photo);
  const dataUrl = await photoToModelDataUrl(photo, SAM_INPUT_MAX_SIDE);
  const { uprightPng, width: origWidth, height: origHeight } = photo;

  const first = input.labelHint?.trim() || "main product";
  const hints = [first, ...FALLBACK_HINTS.filter((h) => h !== first)].slice(
    0,
    MAX_ATTEMPTS,
  );

  const telemetries: ModelCallTelemetry[] = [];
  let lastFailure: { reason: string; codes: CutoutReasonCode[] } = {
    reason: "sam-3.1 returned no segmentation",
    codes: [],
  };

  for (const labelHint of hints) {
    const { data: samOut, telemetry } = await callModelWithTelemetry<
      { imageUrl: string; labelHint: string },
      SamGatewayOutput
    >({
      step: "cutout",
      model: "sam-3.1",
      shopId: input.shopId,
      postId: input.postId,
      input: { imageUrl: dataUrl, labelHint },
    });
    telemetries.push(telemetry);

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
        quality: null,
        telemetry: mergeTelemetry(telemetries),
      };
    }

    const { mask, pixelBox, bbox } = samOut;
    if (!mask || !pixelBox || !bbox) {
      lastFailure = {
        reason: samOut.issue ?? "sam-3.1 returned no segmentation",
        codes: [],
      };
      continue;
    }

    const raster = decodeMaskToRaster(mask);
    const refined = refineMaskRaster(raster, mask.width, mask.height);
    if (refined.stats.foreground === 0) {
      lastFailure = { reason: "sam-3.1 returned an empty mask", codes: [] };
      continue;
    }

    const quality = assessCutout({
      mask: refined.mask,
      width: mask.width,
      height: mask.height,
      stats: refined.stats,
      pixelBox,
    });
    if (!quality.ok) {
      lastFailure = {
        reason: `mask rejected (${quality.reasons.join(", ")})`,
        codes: quality.reasons,
      };
      continue;
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
    const alphaChannel = await rasterToSoftAlpha(
      refined.mask,
      mask.width,
      mask.height,
      cropWidth,
      cropHeight,
    );
    const rgb = await decontaminateEdges(
      croppedRgbBuffer,
      alphaChannel,
      cropWidth,
      cropHeight,
    );

    // Combine 3-channel RGB crop + 1-channel Alpha mask into transparent RGBA PNG.
    // Capped at CUTOUT_MAX_SIDE to stay well within Supabase bucket limits.
    const rawRgba = await sharp(rgb, {
      raw: { width: cropWidth, height: cropHeight, channels: 3 },
    })
      .joinChannel(alphaChannel, {
        raw: { width: cropWidth, height: cropHeight, channels: 1 },
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cutoutBuffer = await sharp(rawRgba.data, {
      raw: { width: rawRgba.info.width, height: rawRgba.info.height, channels: 4 },
    })
      .resize({
        width: CUTOUT_MAX_SIDE,
        height: CUTOUT_MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    const outMeta = await sharp(cutoutBuffer).metadata();

    return {
      cutoutBuffer,
      cutoutDataUrl: `data:image/png;base64,${cutoutBuffer.toString("base64")}`,
      bbox,
      width: outMeta.width ?? cropWidth,
      height: outMeta.height ?? cropHeight,
      confidence: samOut.confidence ?? null,
      quality,
      telemetry: mergeTelemetry(telemetries),
    };
  }

  throw new CutoutFailedError(
    lastFailure.reason,
    mergeTelemetry(telemetries),
    lastFailure.codes,
  );
}

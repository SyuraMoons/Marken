// Pillar 1 — Pixel & Text Fidelity Verifier (FR-FD-01, FR-FD-02, FR-FD-03, F-26).
// 1. Compares the composited product region of the 1080x1350 slide against the
//    confirmed product cutout within tolerance (`FR-FD-01`).
// 2. Calls `Muse Spark` (`step: "verify_slide"`) to verify slide text spelling and
//    shop style rules (`FR-FD-02`).
// 3. Determines eligibility for the "Real product" badge on Today (`FR-FD-03`).

import sharp from "sharp";
import { z } from "zod";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import type { PlacedProductBox } from "./composite";

export const DEFAULT_PIXEL_SCORE_THRESHOLD = 0.985;
export const DEFAULT_MATCHING_PIXEL_RATIO_THRESHOLD = 0.98;
export const DEFAULT_CHANNEL_TOLERANCE = 6;

export const SlideVerificationModelSchema = z.object({
  spellingPassed: z.boolean(),
  rulesPassed: z.boolean(),
  issues: z.array(z.string()).default([]),
});

export type ComputePixelFidelityInput = {
  /** Final 1080x1350 composited slide buffer (or data URL / Uint8Array) */
  slide: Buffer | Uint8Array | string;
  /** Scaled RGBA cutout buffer at `placedBox` dimensions (or unscaled cutout buffer) */
  scaledCutout: Buffer | Uint8Array | string;
  /** Exact coordinates where the cutout was placed on the 1080x1350 slide */
  placedBox: PlacedProductBox;
  /** Minimum pixel fidelity score `[0..1]` required to pass (default: 0.985) */
  pixelScoreThreshold?: number;
  /** Per-channel (0..255) tolerance for counting a pixel as an exact match (default: 6) */
  channelTolerance?: number;
};

export type PixelFidelityResult = {
  /** Whether the product region matches the confirmed cutout within tolerance (`FR-FD-01`) */
  pixelPassed: boolean;
  /** Normalized `[0..1]` pixel similarity score across opaque product pixels */
  pixelFidelityScore: number;
  /** Fraction `[0..1]` of opaque product pixels within `channelTolerance` */
  matchingPixelRatio: number;
  /** Mean absolute per-channel RGB difference `[0..255]` on opaque product pixels */
  meanChannelDelta: number;
  /** Number of opaque product pixels inspected */
  opaquePixelsCompared: number;
};

export type VerifySlideFidelityInput = ComputePixelFidelityInput & {
  /** Expected headline or CTA text rendered on the slide */
  slideText: string;
  /** Shop tone description (e.g. "warm and conversational") */
  shopTone?: string;
  /** Up to 10 shop style rules (e.g. ["Never show prices", "No ALL CAPS"]) */
  styleRules?: string[];
  /** Content language ("en" | "id") */
  contentLanguage?: "en" | "id";
  shopId?: string;
  postId?: string;
};

export type VerifySlideFidelityResult = PixelFidelityResult & {
  /** Overall slide pass: `pixelPassed && spellingPassed && rulesPassed` */
  fidelityPassed: boolean;
  /** Combined `[0..1]` fidelity score stored in `posts.slides[].fidelity_score` */
  fidelityScore: number;
  /** Whether the "Real product" badge may be shown (`FR-FD-03`: true only when `FR-FD-01` passes) */
  realProductBadge: boolean;
  /** Whether `Muse Spark` verified the slide text is spelled accurately (`FR-FD-02`) */
  spellingPassed: boolean;
  /** Whether the slide obeys all shop style rules (`FR-FD-02`, `FR-SP-06`) */
  rulesPassed: boolean;
  /** Any pixel, spelling, or style rule issues detected */
  issues: string[];
  /** Gateway telemetry record for `step: "verify_slide"` (`model: "muse-spark"`) */
  telemetry: ModelCallTelemetry;
};

function resolveBuffer(input: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  const trimmed = input.trim();
  if (trimmed.startsWith("data:image/")) {
    const base64Part = trimmed.split(",")[1] ?? "";
    return Buffer.from(base64Part, "base64");
  }
  return Buffer.from(trimmed, "base64");
}

/**
 *Deterministic local guardrail check for obvious style rule violations in `slideText`
 * (e.g., "Never show prices" / "Jangan tampilkan harga", or forbidden words).
 */
export function evaluateLocalSlideRuleViolations(
  slideText: string,
  styleRules: string[] = [],
): string[] {
  const violations: string[] = [];
  const text = slideText.trim();
  if (!text) return violations;

  for (const rawRule of styleRules) {
    const rule = rawRule.trim();
    if (!rule) continue;
    const lowerRule = rule.toLowerCase();

    // Check "never show price(s)" / "no price(s)" / "jangan tampilkan harga"
    const forbidsPrices =
      /(never|no|don't|do not|without|jangan|tanpa)\b.*\b(price|prices|pricing|cost|harga|diskon)/i.test(
        lowerRule,
      );

    if (forbidsPrices) {
      const hasPricePattern =
        /(\$|€|£|¥|\bRp\.?\s?\d|\bIDR\s?\d|\bUSD\s?\d|\d+[.,]\d{3}\b|\b\d+\s?(rb|ribu|k)\b)/i.test(
          text,
        );
      if (hasPricePattern) {
        violations.push(
          `Slide text "${text}" violates shop style rule: "${rule}" (contains a price/currency).`,
        );
      }
    }

    // Check "no all caps" / "never use all caps"
    const forbidsAllCaps =
      /(never|no|don't|do not|avoid)\b.*\b(all caps|all-caps|uppercase)/i.test(
        lowerRule,
      );
    if (forbidsAllCaps) {
      const words = text.split(/\s+/).filter((w) => /^[A-Z]{4,}$/.test(w));
      if (words.length >= 2) {
        violations.push(
          `Slide text "${text}" violates shop style rule: "${rule}" (uses ALL CAPS words).`,
        );
      }
    }
  }

  return violations;
}

/**
 * Compares the product region of the final slide against the scaled cutout (`FR-FD-01`).
 * Inspects all opaque cutout pixels (`alpha >= 240`) so semi-transparent anti-aliased edge
 * pixels blended with the background do not cause false negatives.
 */
export async function computePixelFidelity(
  input: ComputePixelFidelityInput,
): Promise<PixelFidelityResult> {
  const slideBuf = resolveBuffer(input.slide);
  const cutoutBuf = resolveBuffer(input.scaledCutout);
  const { left, top, width, height } = input.placedBox;

  const scoreThreshold =
    input.pixelScoreThreshold ?? DEFAULT_PIXEL_SCORE_THRESHOLD;
  const channelTolerance =
    input.channelTolerance ?? DEFAULT_CHANNEL_TOLERANCE;

  // Extract the placed product box from the slide
  const slideRegionRaw = await sharp(slideBuf)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Ensure cutout matches exact placedBox dimensions
  const cutoutRaw = await sharp(cutoutBuf)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  let opaquePixelsCompared = 0;
  let matchingPixels = 0;
  let totalChannelDiff = 0;

  for (let i = 0; i < cutoutRaw.length; i += 4) {
    const cutoutAlpha = cutoutRaw[i + 3];
    // Compare solid product interior pixels (`alpha >= 240`)
    if (cutoutAlpha >= 240) {
      opaquePixelsCompared++;
      const dr = Math.abs(slideRegionRaw[i] - cutoutRaw[i]);
      const dg = Math.abs(slideRegionRaw[i + 1] - cutoutRaw[i + 1]);
      const db = Math.abs(slideRegionRaw[i + 2] - cutoutRaw[i + 2]);

      totalChannelDiff += dr + dg + db;
      if (
        dr <= channelTolerance &&
        dg <= channelTolerance &&
        db <= channelTolerance
      ) {
        matchingPixels++;
      }
    }
  }

  if (opaquePixelsCompared === 0) {
    return {
      pixelPassed: false,
      pixelFidelityScore: 0,
      matchingPixelRatio: 0,
      meanChannelDelta: 255,
      opaquePixelsCompared: 0,
    };
  }

  const meanChannelDelta = Number(
    (totalChannelDiff / (opaquePixelsCompared * 3)).toFixed(4),
  );
  const pixelFidelityScore = Number(
    Math.max(0, Math.min(1, 1 - meanChannelDelta / 255)).toFixed(4),
  );
  const matchingPixelRatio = Number(
    (matchingPixels / opaquePixelsCompared).toFixed(4),
  );

  const pixelPassed =
    pixelFidelityScore >= scoreThreshold &&
    matchingPixelRatio >= DEFAULT_MATCHING_PIXEL_RATIO_THRESHOLD;

  return {
    pixelPassed,
    pixelFidelityScore,
    matchingPixelRatio,
    meanChannelDelta,
    opaquePixelsCompared,
  };
}

/**
 * Runs both the deterministic pixel fidelity check (`FR-FD-01`) and the `Muse Spark`
 * slide text spelling & style rule check (`FR-FD-02`), returning the badge eligibility (`FR-FD-03`).
 */
export async function verifySlideFidelity(
  input: VerifySlideFidelityInput,
): Promise<VerifySlideFidelityResult> {
  const slideBuf = resolveBuffer(input.slide);
  const styleRules = (input.styleRules ?? []).slice(0, 10);

  // 1. Run deterministic pixel comparison (`FR-FD-01`)
  const pixelResult = await computePixelFidelity(input);

  // 2. Downscale slide to JPEG data URL for fast multimodal inspection by `Muse Spark` (`FR-FD-02`)
  const previewJpeg = await sharp(slideBuf)
    .resize(720, 900, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  const slideDataUrl = `data:image/jpeg;base64,${previewJpeg.toString("base64")}`;

  // 3. Deterministic local rule check on `slideText`
  const localRuleViolations = evaluateLocalSlideRuleViolations(
    input.slideText,
    styleRules,
  );

  // 4. Call `Muse Spark` via Single Model Gateway (`step: "verify_slide"`)
  const systemPrompt = [
    "You are MARKEN's Pillar 1 Fidelity Verifier (FR-FD-02).",
    "Inspect the rendered carousel slide image and verify:",
    "1. `spellingPassed`: The headline text rendered on the slide is legible and spelled accurately matching the expected `slideText`.",
    "2. `rulesPassed`: Both the expected `slideText` and visible slide copy obey all provided `styleRules` and `shopTone`.",
    'Respond strictly with JSON: { "spellingPassed": boolean, "rulesPassed": boolean, "issues": string[] }.',
  ].join("\n");

  const { data: modelVerdict, telemetry } = await callModelWithTelemetry<
    {
      imageUrl: string;
      prompt: string;
    },
    z.infer<typeof SlideVerificationModelSchema>
  >({
    step: "verify_slide",
    model: "muse-spark",
    shopId: input.shopId,
    postId: input.postId,
    systemPrompt,
    schema: SlideVerificationModelSchema,
    input: {
      imageUrl: slideDataUrl,
      prompt: JSON.stringify({
        expectedSlideText: input.slideText,
        contentLanguage: input.contentLanguage ?? "en",
        shopTone: input.shopTone ?? "warm and authentic",
        styleRules,
      }),
    },
  });

  const issues: string[] = [...modelVerdict.issues];
  if (!pixelResult.pixelPassed) {
    issues.unshift(
      `Product pixel fidelity check failed (score=${pixelResult.pixelFidelityScore}, matchingRatio=${pixelResult.matchingPixelRatio}).`,
    );
  }
  for (const v of localRuleViolations) {
    if (!issues.includes(v)) {
      issues.push(v);
    }
  }

  const spellingPassed = modelVerdict.spellingPassed;
  const rulesPassed =
    modelVerdict.rulesPassed && localRuleViolations.length === 0;
  const fidelityPassed =
    pixelResult.pixelPassed && spellingPassed && rulesPassed;

  // Compute overall fidelityScore stored on the slide record
  const textPenalty = (!spellingPassed ? 0.15 : 0) + (!rulesPassed ? 0.25 : 0);
  const fidelityScore = Number(
    Math.max(0, pixelResult.pixelFidelityScore - textPenalty).toFixed(4),
  );

  return {
    ...pixelResult,
    fidelityPassed,
    fidelityScore,
    // FR-FD-03: Today shows "Real product" badge only when FR-FD-01 (pixel check) passes
    realProductBadge: pixelResult.pixelPassed,
    spellingPassed,
    rulesPassed,
    issues,
    telemetry,
  };
}


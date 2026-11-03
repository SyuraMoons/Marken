// Pillar 1 — Product Studio Orchestrator (F-09, F-22, F-26, FR-CG-04, FR-CG-09, FR-FD-01..03).
// Chains `generateSlideScene` (Muse Image 1080x1350 with reserved empty area) ->
// `compositeProductSlide` (deterministic `sharp` cutout + shadow compositing) ->
// `verifySlideFidelity` (`sharp` pixel comparison + `Muse Spark` text & style rule check).
// Automatically rebuilds once on failure (`FR-FD-01`, `FR-FD-02`), then flags if still failing.

import type { ModelCallTelemetry } from "../gateway";
import {
  compositeProductSlide,
  type CompositeProductSlideInput,
  type CompositeProductSlideResult,
  type DropShadowOptions,
  type PlacedProductBox,
} from "./composite";
import {
  CutoutFailedError,
  cutoutProduct,
  type CutoutProductInput,
  type CutoutProductResult,
  type NormalizedBBox,
} from "./cutout";
import {
  computePixelFidelity,
  DEFAULT_CHANNEL_TOLERANCE,
  DEFAULT_MATCHING_PIXEL_RATIO_THRESHOLD,
  DEFAULT_PIXEL_SCORE_THRESHOLD,
  evaluateLocalSlideRuleViolations,
  SlideVerificationModelSchema,
  verifySlideFidelity,
  type ComputePixelFidelityInput,
  type PixelFidelityResult,
  type VerifySlideFidelityInput,
  type VerifySlideFidelityResult,
} from "./fidelity";
import { defaultTextBox, defaultTextLayer, type BrandStyle, type SlideLayers } from "./layers";
import { pickTextColor, renderLayeredSlide } from "./render";
import {
  buildScenePrompt,
  clampReservedBox,
  DEFAULT_RESERVED_BOX,
  generateSlideScene,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type GenerateSlideSceneInput,
  type GenerateSlideSceneResult,
  type ReservedBox,
} from "./scene";

export {
  buildScenePrompt,
  clampReservedBox,
  compositeProductSlide,
  computePixelFidelity,
  CutoutFailedError,
  cutoutProduct,
  DEFAULT_CHANNEL_TOLERANCE,
  DEFAULT_MATCHING_PIXEL_RATIO_THRESHOLD,
  DEFAULT_PIXEL_SCORE_THRESHOLD,
  DEFAULT_RESERVED_BOX,
  evaluateLocalSlideRuleViolations,
  generateSlideScene,
  SlideVerificationModelSchema,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  verifySlideFidelity,
  type CompositeProductSlideInput,
  type CompositeProductSlideResult,
  type ComputePixelFidelityInput,
  type CutoutProductInput,
  type CutoutProductResult,
  type DropShadowOptions,
  type GenerateSlideSceneInput,
  type GenerateSlideSceneResult,
  type NormalizedBBox,
  type PixelFidelityResult,
  type PlacedProductBox,
  type ReservedBox,
  type VerifySlideFidelityInput,
  type VerifySlideFidelityResult,
};

export type RenderAndVerifySlideInput = {
  /** Scene description from the trend analysis or daily carousel plan */
  sceneBrief: string;
  /** Headline or CTA copy rendered on the slide (defaults to empty string if omitted) */
  slideText?: string;
  /** Optional slide role (`hook` | `product` | `cta`) */
  slideRole?: "hook" | "product" | "cta";
  /** Optional visual style guidance */
  visualStyle?: string;
  /** Confirmed transparent RGBA product cutout buffer, Uint8Array, or data URL */
  cutout: Buffer | Uint8Array | string;
  /** Optional custom reserved box on the 1080x1350 canvas */
  reservedBox?: Partial<ReservedBox>;
  /** Optional drop shadow settings */
  shadow?: DropShadowOptions;
  /** Shop tone for rule verification */
  shopTone?: string;
  /** Up to 10 shop style rules (e.g. ["Never show prices"]) */
  styleRules?: string[];
  /** Content language ("en" | "id") */
  contentLanguage?: "en" | "id";
  /** Maximum rebuild retries when fidelity check fails (default: 1 per FR-FD-01..02) */
  maxRetries?: number;
  /** Brand kit colours and fonts for the text layers (SRD A-09). */
  brand?: BrandStyle;
  shopId?: string;
  postId?: string;
};

export type RenderAndVerifySlideResult = {
  /** Editable layers behind the slide (SRD A-09): the owner can change text or product placement without a new scene */
  layers: SlideLayers;
  /** Final 1080x1350 composited slide PNG buffer (`posts.slides[].slide_path`) */
  slideBuffer: Buffer;
  /** `data:image/png;base64,...` of the final slide */
  slideDataUrl: string;
  /** Standalone 1080x1350 scene PNG buffer without product (`posts.slides[].scene_path`, `FR-CG-04`) */
  sceneBuffer: Buffer;
  /** `data:image/png;base64,...` of the standalone scene */
  sceneDataUrl: string;
  width: typeof SLIDE_WIDTH;
  height: typeof SLIDE_HEIGHT;
  /** Reserved empty box used in the scene */
  reservedBox: ReservedBox;
  /** Exact coordinates where the scaled product cutout was placed */
  placedBox: PlacedProductBox;
  /** Whether the slide passed both pixel and text/rule fidelity checks (`posts.slides[].fidelity_passed`) */
  fidelityPassed: boolean;
  /** Combined `[0..1]` fidelity score (`posts.slides[].fidelity_score`) */
  fidelityScore: number;
  /** Eligibility for the "Real product" badge on Today (`FR-FD-03`) */
  realProductBadge: boolean;
  /** True when the slide still failed after the 1x auto-rebuild (`FR-FD-01..02`) */
  flagged: boolean;
  /** Full fidelity breakdown (`pixelPassed`, `spellingPassed`, `rulesPassed`, `issues`) */
  fidelity: VerifySlideFidelityResult;
  /** Number of render attempts executed (1 on first-try pass, 2 when rebuilt once) */
  attempts: number;
  /** Ordered gateway telemetry records across all steps (`render_image`, `verify_slide`, optional `regenerate_image`) */
  telemetry: ModelCallTelemetry[];
  /** Sum of `costUsd` across all model calls for this slide */
  totalCostUsd: number;
  /** Total wall-clock execution time in milliseconds */
  totalLatencyMs: number;
};

/**
 * Orchestrates Pillar 1 Studio for a single carousel slide (`T-6.4`):
 * 1. `generateSlideScene` (`Muse Image` 1080x1350 with reserved empty area)
 * 2. `compositeProductSlide` (deterministic `sharp` auto-fit + drop shadow)
 * 3. `verifySlideFidelity` (`sharp` pixel check + `Muse Spark` spelling & style rule check)
 * 4. If fidelity fails, automatically rebuilds once (`step: "regenerate_image"`), then flags if still failing.
 *
 * Supports both `renderAndVerifySlide(inputObj)` and `renderAndVerifySlide(sceneBrief, cutoutBuffer)`.
 */
export async function renderAndVerifySlide(
  inputOrSceneBrief: RenderAndVerifySlideInput | string,
  cutoutBufferArg?: Buffer | Uint8Array | string,
): Promise<RenderAndVerifySlideResult> {
  const startedAt = Date.now();
  if (typeof inputOrSceneBrief === "string" && !cutoutBufferArg) {
    throw new Error(
      "renderAndVerifySlide requires a valid, non-empty product cutout buffer",
    );
  }

  const input: RenderAndVerifySlideInput =
    typeof inputOrSceneBrief === "string"
      ? {
          sceneBrief: inputOrSceneBrief,
          slideText: "",
          cutout: cutoutBufferArg!,
        }
      : inputOrSceneBrief;

  if (
    !input.cutout ||
    (Buffer.isBuffer(input.cutout) && input.cutout.length === 0) ||
    (typeof input.cutout === "string" && !input.cutout.trim())
  ) {
    throw new Error(
      "renderAndVerifySlide requires a valid, non-empty product cutout buffer",
    );
  }

  const maxRetries =
    typeof input.maxRetries === "number" && input.maxRetries >= 0
      ? Math.min(2, Math.round(input.maxRetries))
      : 1;
  const maxAttempts = 1 + maxRetries;

  const allTelemetry: ModelCallTelemetry[] = [];
  let lastScene!: GenerateSlideSceneResult;
  let lastComposite!: CompositeProductSlideResult;
  let lastLayers!: SlideLayers;
  let lastFidelity!: VerifySlideFidelityResult;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    const isRetry = attempt > 1;
    const retryNote =
      isRetry && lastFidelity?.issues.length
        ? ` Retry correction required: ${lastFidelity.issues.join("; ")}. Ensure the central product zone is completely unobstructed and slide text is spelled accurately.`
        : "";

    // Step 1: Generate the 1080x1350 scene with a reserved empty product area and NO text (`FR-CG-04`, A-09).
    lastScene = await generateSlideScene({
      sceneBrief: `${input.sceneBrief.trim()}${retryNote}`,
      slideText: "",
      slideRole: input.slideRole,
      visualStyle: input.visualStyle,
      reservedBox: input.reservedBox,
      step: isRetry ? "regenerate_image" : "render_image",
      shopId: input.shopId,
      postId: input.postId,
    });
    allTelemetry.push(lastScene.telemetry);

    // Step 2: Layers. Text is drawn by code in a readable brand colour; the product goes last (`FR-CG-09`).
    const textBox = defaultTextBox(input.slideRole);
    const textColor = await pickTextColor(lastScene.sceneBuffer, textBox, input.brand?.colors);
    const inset = Math.round(lastScene.reservedBox.width * 0.06);
    const insetY = Math.round(lastScene.reservedBox.height * 0.06);
    lastLayers = {
      sceneBrief: input.sceneBrief.trim(),
      product: {
        box: {
          x: lastScene.reservedBox.x + inset,
          y: lastScene.reservedBox.y + insetY,
          width: lastScene.reservedBox.width - inset * 2,
          height: lastScene.reservedBox.height - insetY * 2,
        },
      },
      text: input.slideText?.trim()
        ? [defaultTextLayer({ role: input.slideRole, text: input.slideText.trim(), color: textColor, brand: input.brand })]
        : [],
    };
    const rendered = await renderLayeredSlide({
      scene: lastScene.sceneBuffer,
      cutout: Buffer.isBuffer(input.cutout) ? input.cutout : typeof input.cutout === "string" ? Buffer.from(input.cutout.replace(/^data:image\/[a-z+]+;base64,/, ""), "base64") : Buffer.from(input.cutout),
      layers: lastLayers,
      shadow: input.shadow,
    });
    // Store the tight placed box so later edits re-render the same size.
    lastLayers = {
      ...lastLayers,
      product: { box: { x: rendered.placedBox.left, y: rendered.placedBox.top, width: rendered.placedBox.width, height: rendered.placedBox.height } },
    };
    lastComposite = {
      slideBuffer: rendered.slideBuffer,
      slideDataUrl: `data:image/png;base64,${rendered.slideBuffer.toString("base64")}`,
      scaledCutoutBuffer: rendered.scaledCutoutBuffer,
      placedBox: rendered.placedBox,
      reservedBox: lastScene.reservedBox,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
    };

    // Step 3: Verify pixel fidelity (`FR-FD-01`) + slide text spelling & rules (`FR-FD-02`)
    lastFidelity = await verifySlideFidelity({
      slide: lastComposite.slideBuffer,
      scaledCutout: lastComposite.scaledCutoutBuffer,
      placedBox: lastComposite.placedBox,
      slideText: input.slideText ?? "",
      shopTone: input.shopTone,
      styleRules: input.styleRules,
      contentLanguage: input.contentLanguage,
      shopId: input.shopId,
      postId: input.postId,
    });
    allTelemetry.push(lastFidelity.telemetry);

    if (lastFidelity.fidelityPassed) {
      break;
    }

    // Fix 2 (PR #36 review): Pixel failure is deterministic under the same cutout and box,
    // so regenerating the scene cannot fix it. Only retry when spelling or rule checks fail,
    // protecting the < $0.10 per carousel budget.
    if (
      !lastFidelity.pixelPassed &&
      lastFidelity.spellingPassed &&
      lastFidelity.rulesPassed
    ) {
      break;
    }
  }

  const totalCostUsd = Number(
    allTelemetry.reduce((sum, t) => sum + t.costUsd, 0).toFixed(6),
  );
  const totalLatencyMs = Math.max(1, Date.now() - startedAt);

  return {
    layers: lastLayers,
    slideBuffer: lastComposite.slideBuffer,
    slideDataUrl: lastComposite.slideDataUrl,
    sceneBuffer: lastScene.sceneBuffer,
    sceneDataUrl: lastScene.sceneDataUrl,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    reservedBox: lastComposite.reservedBox,
    placedBox: lastComposite.placedBox,
    fidelityPassed: lastFidelity.fidelityPassed,
    fidelityScore: lastFidelity.fidelityScore,
    realProductBadge: lastFidelity.realProductBadge,
    flagged: !lastFidelity.fidelityPassed,
    fidelity: lastFidelity,
    attempts,
    telemetry: allTelemetry,
    totalCostUsd,
    totalLatencyMs,
  };
}


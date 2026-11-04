// Pillar 1 — Product Studio Orchestrator (F-09, F-22, F-26, FR-CG-04, FR-CG-09, FR-FD-01..03).
// Chains `generateSlideScene` (Muse Image 1080x1350 with reserved empty area) ->
// `compositeProductSlide` (deterministic `sharp` cutout + shadow compositing) ->
// `verifySlideFidelity` (`sharp` pixel comparison + `Muse Spark` text & style rule check).
// Only the product check blocks Approve; a text issue is returned as a note for the owner.

import type { ModelCallTelemetry } from "../gateway";
import {
  compositeProductSlide,
  type CompositeProductSlideInput,
  type CompositeProductSlideResult,
  type DropShadowOptions,
  type FramingMode,
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
import { extractProductPalette } from "./palette";
import { applyTemplateLayout, TEMPLATES_WITH_TEXT_ON_SHAPE, type TemplateId } from "./templates";
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
  headline?: string;
  subline?: string;
  bigWord?: string;
  categoryTag?: string;
  framingMode?: FramingMode;
  cameraAngle?: string;
  surfaceType?: string;
  lightingStyle?: string;
  templateId?: TemplateId;
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
  /** Product check (`FR-FD-01`, `posts.slides[].fidelity_passed`): the only result that blocks Approve */
  fidelityPassed: boolean;
  /** Product pixel score `[0..1]` (`posts.slides[].fidelity_score`) */
  fidelityScore: number;
  /** Spelling and style rules passed (`FR-FD-02`, `posts.slides[].text_passed`) */
  textPassed: boolean;
  /** Text problems for the owner to fix in the slide editor (`posts.slides[].text_issues`) */
  textIssues: string[];
  /** Eligibility for the "Real product" badge on Today (`FR-FD-03`) */
  realProductBadge: boolean;
  /** True when the product check failed (`FR-FD-01`) */
  flagged: boolean;
  /** Full fidelity breakdown (`pixelPassed`, `spellingPassed`, `rulesPassed`, `issues`) */
  fidelity: VerifySlideFidelityResult;
  /** Render attempts executed (always 1: a new scene cannot change either check) */
  attempts: number;
  /** Ordered gateway telemetry records (`render_image`, `verify_slide`) */
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
 * 4. Flags the slide when the product check fails; text issues come back as notes.
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

  const cutoutBuf = Buffer.isBuffer(input.cutout)
    ? input.cutout
    : typeof input.cutout === "string"
    ? Buffer.from(input.cutout.replace(/^data:image\/[a-z+]+;base64,/, ""), "base64")
    : Buffer.from(input.cutout);

  // Layout first: the template decides where the product goes, and that same box is the
  // area Muse Image must leave empty (FR-CG-04). Product slides default to a layout with text.
  const chosenTemplate: TemplateId | undefined = input.templateId ?? (
    input.slideRole === "hook" ? "product-poster" :
    input.slideRole === "product" ? "pedestal-hero" :
    input.slideRole === "cta" ? "product-with-name" : undefined
  );
  let templateLayers: SlideLayers | null = null;
  if (chosenTemplate) {
    const productPalette = await extractProductPalette(cutoutBuf);
    // Brand kit colours (SRD A-09) win over colours read from the product.
    const brandColors = (input.brand?.colors ?? []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
    const palette = {
      ...productPalette,
      dominant: brandColors[0] ?? productPalette.dominant,
      accent: brandColors[1] ?? productPalette.accent,
    };
    const headline = input.headline?.trim() || input.slideText?.trim() || "";
    const text = input.slideText?.trim();
    templateLayers = applyTemplateLayout({
      templateId: chosenTemplate,
      sceneBrief: input.sceneBrief.trim(),
      headline,
      subline: input.subline?.trim(),
      // The call to action slide keeps its action line when the headline is something else.
      cta: input.slideRole === "cta" && text && text !== headline ? text : undefined,
      bigWord: input.bigWord?.trim(),
      categoryTag: input.categoryTag?.trim(),
      palette,
      productBox: input.reservedBox,
      fontHeading: input.brand?.headingFont ?? undefined,
      fontBody: input.brand?.bodyFont ?? undefined,
    });
  }

  const allTelemetry: ModelCallTelemetry[] = [];
  let lastScene!: GenerateSlideSceneResult;
  let lastComposite!: CompositeProductSlideResult;
  let lastLayers!: SlideLayers;
  let lastFidelity!: VerifySlideFidelityResult;

  // One pass, no automatic rebuild: the product is composited by code and the text is drawn by code,
  // so a new Muse Image scene can change neither check. A rebuild only added a paid image call (NFR-06).
  {
    // Step 1: Generate the 1080x1350 scene with a reserved empty product area and NO text (`FR-CG-04`, A-09).
    lastScene = await generateSlideScene({
      sceneBrief: input.sceneBrief.trim(),
      slideText: "",
      slideRole: input.slideRole,
      visualStyle: input.visualStyle,
      cameraAngle: input.cameraAngle,
      surfaceType: input.surfaceType,
      lightingStyle: input.lightingStyle,
      reservedBox: templateLayers?.product.box ?? input.reservedBox,
      step: "render_image",
      shopId: input.shopId,
      postId: input.postId,
    });
    allTelemetry.push(lastScene.telemetry);

    // Step 2: Layers. Text is drawn by code; the product goes last (`FR-CG-09`).
    if (templateLayers && chosenTemplate) {
      const scene = lastScene.sceneBuffer;
      const brandColors = input.brand?.colors ?? [];
      // Text on a template card, banner or CTA pill keeps the template colour. Text on the scene
      // itself gets a colour that reads against it; the decorative big word stays the accent.
      const onPill = templateLayers.background?.cta === true;
      const text = TEMPLATES_WITH_TEXT_ON_SHAPE.has(chosenTemplate)
        ? templateLayers.text
        : await Promise.all(
            templateLayers.text.map(async (t) =>
              t.id === "big-type-behind" || (onPill && t.id === "cta")
                ? t
                : { ...t, color: await pickTextColor(scene, t.box, [...brandColors, t.color]) },
            ),
          );
      lastLayers = { ...templateLayers, product: { box: lastScene.reservedBox }, text };
    } else {
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
    }

    const rendered = await renderLayeredSlide({
      scene: lastScene.sceneBuffer,
      cutout: cutoutBuf,
      layers: lastLayers,
      shadow: input.shadow,
      framingMode: input.framingMode,
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
      // Check the words actually drawn on the slide (headline, subline, big word, CTA).
      slideText: lastLayers.text.map((t) => t.text.trim()).filter(Boolean).join(" "),
      shopTone: input.shopTone,
      styleRules: input.styleRules,
      contentLanguage: input.contentLanguage,
      shopId: input.shopId,
      postId: input.postId,
    });
    allTelemetry.push(lastFidelity.telemetry);
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
    textPassed: lastFidelity.textPassed,
    textIssues: lastFidelity.textPassed ? [] : lastFidelity.issues,
    realProductBadge: lastFidelity.realProductBadge,
    flagged: !lastFidelity.fidelityPassed,
    fidelity: lastFidelity,
    attempts: 1,
    telemetry: allTelemetry,
    totalCostUsd,
    totalLatencyMs,
  };
}


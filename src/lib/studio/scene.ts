// Pillar 1 — Scene Generator (FR-CG-04, F-09, F-22).
// Calls `muse-image` (`muse-image-1.0`) through the Single Model Gateway to generate
// a 1080x1350 (4:5) background scene with a mandatory reserved empty product area
// and slide text. It NEVER receives an instruction to draw the product.

import sharp from "sharp";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

export type ReservedBox = {
  /** Left offset in pixels on the 1080x1350 canvas */
  x: number;
  /** Top offset in pixels on the 1080x1350 canvas */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
};

/**
 * Default central reserved product zone on a 1080x1350 (4:5) slide.
 * Leaves top header (`y: 0..300`) and bottom footer (`y: 1020..1350`) for slide text.
 */
export const DEFAULT_RESERVED_BOX: ReservedBox = {
  x: 240,
  y: 300,
  width: 600,
  height: 720,
};

export type GenerateSlideSceneInput = {
  /** Scene description from the trend analysis or daily carousel plan */
  sceneBrief: string;
  /** On-slide headline or call-to-action copy */
  slideText: string;
  /** Optional slide role in the 3-slide carousel (`hook` | `product` | `cta`) */
  slideRole?: "hook" | "product" | "cta";
  /** Optional visual style guidance from the trend analysis */
  visualStyle?: string;
  /** Specific camera perspective: top-down, low-angle hero, eye-level, macro */
  cameraAngle?: string;
  /** Realistic surface material: slate rock, weathered wood, matte marble, icy podium */
  surfaceType?: string;
  /** Directional lighting style: side rim-light, top-down daylight, soft studio glow */
  lightingStyle?: string;
  /** Custom pixel bounding box reserved for the real product cutout */
  reservedBox?: Partial<ReservedBox>;
  /** Gateway step (`render_image` by default, or `regenerate_image` for P1 slide regen) */
  step?: "render_image" | "regenerate_image";
  shopId?: string;
  postId?: string;
};

export type GenerateSlideSceneResult = {
  /** 1080x1350 RGBA PNG Buffer of the background scene ONLY (without product) */
  sceneBuffer: Buffer;
  /** `data:image/png;base64,...` representation of the 1080x1350 scene */
  sceneDataUrl: string;
  width: typeof SLIDE_WIDTH;
  height: typeof SLIDE_HEIGHT;
  /** Exact clamped pixel bounding box reserved for `compositeProductSlide` */
  reservedBox: ReservedBox;
  /** Final guarded prompt sent to `muse-image` */
  promptUsed: string;
  /** Gateway telemetry record (`step: "render_image" | "regenerate_image"`, `model: "muse-image"`) */
  telemetry: ModelCallTelemetry;
};

type MuseImageGatewayOutput = {
  imageBase64?: string | null;
  imageUrl?: string | null;
  width?: number;
  height?: number;
  reservedBox?: Partial<ReservedBox>;
};

/**
 * Clamps a partial or out-of-bounds `ReservedBox` safely inside the `1080x1350` slide canvas.
 */
export function clampReservedBox(box?: Partial<ReservedBox>): ReservedBox {
  const rawX = Number.isFinite(box?.x) ? Math.round(box!.x!) : DEFAULT_RESERVED_BOX.x;
  const rawY = Number.isFinite(box?.y) ? Math.round(box!.y!) : DEFAULT_RESERVED_BOX.y;
  const rawW =
    Number.isFinite(box?.width) && box!.width! > 0
      ? Math.round(box!.width!)
      : DEFAULT_RESERVED_BOX.width;
  const rawH =
    Number.isFinite(box?.height) && box!.height! > 0
      ? Math.round(box!.height!)
      : DEFAULT_RESERVED_BOX.height;

  const minDim = 120;
  const x = Math.max(0, Math.min(SLIDE_WIDTH - minDim, rawX));
  const y = Math.max(0, Math.min(SLIDE_HEIGHT - minDim, rawY));
  const width = Math.max(minDim, Math.min(SLIDE_WIDTH - x, rawW));
  const height = Math.max(minDim, Math.min(SLIDE_HEIGHT - y, rawH));

  return { x, y, width, height };
}

/**
 * Constructs a guarded prompt for `Muse Image` (`FR-CG-04`) that specifies:
 * 1. Exact `1080x1350` (4:5) vertical composition.
 * 2. The reserved empty product zone coordinates (`x=..`, `y=..`).
 * 3. Slide text placement outside the reserved zone.
 * 4. Hard negative constraint forbidding drawing any product, bottle, jar, package, or merchandise.
 */
export function buildScenePrompt(
  input: GenerateSlideSceneInput,
  reservedBox: ReservedBox = DEFAULT_RESERVED_BOX,
): string {
  const box = clampReservedBox(reservedBox);
  const x2 = box.x + box.width;
  const y2 = box.y + box.height;
  const roleLabel = input.slideRole ? ` (${input.slideRole.toUpperCase()} slide)` : "";
  const styleClause = input.visualStyle?.trim()
    ? `Visual style: ${input.visualStyle.trim()}.`
    : "Commercial product photography in a luxury style, photorealism, 8K, soft studio-style lighting, uniform matte background.";

  const cameraClause = input.cameraAngle?.trim()
    ? `Camera perspective: ${input.cameraAngle.trim()}.`
    : "";
  const surfaceClause = input.surfaceType?.trim()
    ? `Surface grounding: The product stage features a physical, realistic ${input.surfaceType.trim()} surface with natural texture and physical contact plane.`
    : "";
  const lightingClause = input.lightingStyle?.trim()
    ? `Lighting: ${input.lightingStyle.trim()} with realistic ambient occlusion and directional shadows.`
    : "";

  return [
    `Create a vertical 4:5 (1080x1350) Instagram commercial product background scene${roleLabel}.`,
    `Scene brief: ${input.sceneBrief.trim()}.`,
    styleClause,
    cameraClause,
    surfaceClause,
    lightingClause,
    "Do not render any text, letters, numbers, logos or watermarks anywhere in the image. Slide text is added separately by code (SRD A-09), so keep the top and bottom bands calm and uncluttered.",
    `MANDATORY RESERVED EMPTY PRODUCT AREA: Leave the central zone x=${box.x}..${x2}, y=${box.y}..${y2} (${box.width}x${box.height}px) completely empty, clean, and unobstructed on top of the podium/surface so the real physical product cutout can be composited later.`,
    `CRITICAL RULE (FR-CG-04): NEVER draw, render, or hallucinate any product, bottle, jar, package, box, container, sunglasses, or merchandise in the reserved area or anywhere as the hero subject. Only generate the empty stage, podium, environmental textures, and atmospheric lighting.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function resolveSceneImageBuffer(
  out: MuseImageGatewayOutput,
): Promise<Buffer> {
  if (typeof out.imageBase64 === "string" && out.imageBase64.trim()) {
    const cleaned = out.imageBase64
      .trim()
      .replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    return Buffer.from(cleaned, "base64");
  }

  if (typeof out.imageUrl === "string" && out.imageUrl.trim()) {
    const trimmed = out.imageUrl.trim();
    if (trimmed.startsWith("data:image/")) {
      const base64Part = trimmed.split(",")[1] ?? "";
      return Buffer.from(base64Part, "base64");
    }
    const res = await fetch(trimmed);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch generated scene image from URL (${res.status}): ${trimmed}`,
      );
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  throw new Error(
    "Muse Image gateway response did not contain imageBase64 or imageUrl",
  );
}

/**
 * Generates a 1080x1350 (4:5) slide background scene with a reserved empty product area (`FR-CG-04`).
 */
export async function generateSlideScene(
  input: GenerateSlideSceneInput,
): Promise<GenerateSlideSceneResult> {
  const reservedBox = clampReservedBox(input.reservedBox);
  const promptUsed = buildScenePrompt(input, reservedBox);
  const step = input.step ?? "render_image";

  const { data: rawScene, telemetry } = await callModelWithTelemetry<
    {
      prompt: string;
      size: string;
      reservedBox: ReservedBox;
      slideText: string;
      slideRole?: string;
    },
    MuseImageGatewayOutput
  >({
    step,
    model: "muse-image",
    shopId: input.shopId,
    postId: input.postId,
    input: {
      prompt: promptUsed,
      size: `${SLIDE_WIDTH}x${SLIDE_HEIGHT}`,
      reservedBox,
      slideText: input.slideText.trim(),
      slideRole: input.slideRole,
    },
  });

  const rawBuffer = await resolveSceneImageBuffer(rawScene);

  // Normalize any provider aspect ratio/resolution to an exact 1080x1350 RGBA PNG (F-22)
  const sceneBuffer = await sharp(rawBuffer)
    .resize(SLIDE_WIDTH, SLIDE_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  return {
    sceneBuffer,
    sceneDataUrl: `data:image/png;base64,${sceneBuffer.toString("base64")}`,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    reservedBox,
    promptUsed,
    telemetry,
  };
}


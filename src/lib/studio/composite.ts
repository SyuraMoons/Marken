// Pillar 1 — Deterministic Product Compositor (FR-CG-09, F-09).
// Composites the owner-confirmed transparent RGBA product cutout into the reserved
// empty area of a 1080x1350 scene using `sharp` (auto-fit scale + soft drop shadow).
// Product pixels are NEVER passed back through a generative model.

import sharp, { type OverlayOptions } from "sharp";
import {
  clampReservedBox,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type ReservedBox,
} from "./scene";

export type PlacedProductBox = {
  /** Exact left pixel coordinate where the scaled cutout was placed on the 1080x1350 slide */
  left: number;
  /** Exact top pixel coordinate where the scaled cutout was placed on the 1080x1350 slide */
  top: number;
  /** Exact width of the scaled cutout in pixels */
  width: number;
  /** Exact height of the scaled cutout in pixels */
  height: number;
};

export type DropShadowOptions = {
  /** Whether to render a soft grounding drop shadow behind the product (default: true) */
  enabled?: boolean;
  /** Horizontal shadow offset in pixels (default: 0) */
  offsetX?: number;
  /** Vertical shadow offset in pixels (default: 18) */
  offsetY?: number;
  /** Gaussian blur sigma for the shadow silhouette (default: 14) */
  blurSigma?: number;
  /** Shadow opacity multiplier `[0..1]` (default: 0.32) */
  opacity?: number;
};

export type CompositeProductSlideInput = {
  /** 1080x1350 scene PNG buffer, Uint8Array, or data URL from `generateSlideScene` */
  scene: Buffer | Uint8Array | string;
  /** Confirmed transparent RGBA PNG cutout buffer, Uint8Array, or data URL from `cutoutProduct` */
  cutout: Buffer | Uint8Array | string;
  /** Target empty area on the 1080x1350 canvas (defaults to `DEFAULT_RESERVED_BOX`) */
  reservedBox?: Partial<ReservedBox>;
  /** Padding ratio inside `reservedBox` on each side (default: 0.06 = 6% breathing room) */
  paddingRatio?: number;
  /** Soft drop shadow configuration (`FR-CG-09`) */
  shadow?: DropShadowOptions;
};

export type CompositeProductSlideResult = {
  /** Final 1080x1350 PNG slide buffer with shadow + real product cutout composited */
  slideBuffer: Buffer;
  /** `data:image/png;base64,...` representation of the final slide */
  slideDataUrl: string;
  /** Scaled RGBA PNG buffer of the cutout at the exact dimensions placed on the slide (used by `verifySlideFidelity`) */
  scaledCutoutBuffer: Buffer;
  /** Exact pixel coordinates of the placed product on the 1080x1350 slide (used by `verifySlideFidelity`) */
  placedBox: PlacedProductBox;
  /** Clamped reserved box used for layout */
  reservedBox: ReservedBox;
  width: typeof SLIDE_WIDTH;
  height: typeof SLIDE_HEIGHT;
};

function resolveImageBytes(input: Buffer | Uint8Array | string): Buffer {
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
 * Generates a full-canvas (1080x1350) RGBA soft drop shadow buffer positioned behind the cutout.
 * Creating a 1080x1350 canvas layer guarantees `sharp.composite` never throws out-of-bounds
 * errors even when the product or blur margin sits near the edge of the slide.
 */
async function buildCanvasShadowLayer(params: {
  scaledCutoutBuffer: Buffer;
  placedBox: PlacedProductBox;
  offsetX: number;
  offsetY: number;
  blurSigma: number;
  opacity: number;
}): Promise<Buffer> {
  const { scaledCutoutBuffer, placedBox, offsetX, offsetY, blurSigma, opacity } =
    params;

  const rawRgba = await sharp(scaledCutoutBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Create a full 1080x1350 single-channel alpha mask at the shifted shadow coordinates
  const canvasAlpha = Buffer.alloc(SLIDE_WIDTH * SLIDE_HEIGHT, 0);
  const clampedOpacity = Math.max(0, Math.min(1, opacity));

  for (let y = 0; y < placedBox.height; y++) {
    const destY = placedBox.top + offsetY + y;
    if (destY < 0 || destY >= SLIDE_HEIGHT) continue;

    for (let x = 0; x < placedBox.width; x++) {
      const destX = placedBox.left + offsetX + x;
      if (destX < 0 || destX >= SLIDE_WIDTH) continue;

      const srcAlpha = rawRgba[(y * placedBox.width + x) * 4 + 3];
      if (srcAlpha > 0) {
        canvasAlpha[destY * SLIDE_WIDTH + destX] = Math.round(
          srcAlpha * clampedOpacity,
        );
      }
    }
  }

  // Blur the shadow alpha silhouette deterministically
  const blurredAlpha =
    blurSigma >= 0.5
      ? await sharp(canvasAlpha, {
          raw: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, channels: 1 },
        })
          .blur(blurSigma)
          .raw()
          .toBuffer()
      : canvasAlpha;

  // Combine warm dark shadow RGB (18, 12, 6) with the blurred alpha channel
  const shadowRgba = Buffer.allocUnsafe(SLIDE_WIDTH * SLIDE_HEIGHT * 4);
  for (let i = 0; i < SLIDE_WIDTH * SLIDE_HEIGHT; i++) {
    const idx = i * 4;
    shadowRgba[idx] = 18;
    shadowRgba[idx + 1] = 12;
    shadowRgba[idx + 2] = 6;
    shadowRgba[idx + 3] = blurredAlpha[i];
  }

  return sharp(shadowRgba, {
    raw: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Deterministically composites the confirmed product cutout into the reserved empty area
 * of a 1080x1350 slide scene (`FR-CG-09`).
 */
export async function compositeProductSlide(
  input: CompositeProductSlideInput,
): Promise<CompositeProductSlideResult> {
  const reservedBox = clampReservedBox(input.reservedBox);
  const paddingRatio =
    typeof input.paddingRatio === "number" &&
    input.paddingRatio >= 0 &&
    input.paddingRatio <= 0.35
      ? input.paddingRatio
      : 0.06;

  const sceneBytes = resolveImageBytes(input.scene);
  const cutoutBytes = resolveImageBytes(input.cutout);

  // 1. Ensure scene is an exact 1080x1350 RGBA canvas
  const normalizedSceneBuffer = await sharp(sceneBytes)
    .resize(SLIDE_WIDTH, SLIDE_HEIGHT, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .png()
    .toBuffer();

  // 2. Compute inner bounding box with breathing room inside reservedBox
  const padX = Math.round(reservedBox.width * paddingRatio);
  const padY = Math.round(reservedBox.height * paddingRatio);
  const maxProductWidth = Math.max(64, reservedBox.width - padX * 2);
  const maxProductHeight = Math.max(64, reservedBox.height - padY * 2);

  // 3. Scale cutout proportionally (`fit: "inside"`) without distorting aspect ratio
  const scaledCutoutBuffer = await sharp(cutoutBytes)
    .ensureAlpha()
    .resize(maxProductWidth, maxProductHeight, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const scaledMeta = await sharp(scaledCutoutBuffer).metadata();
  const scaledWidth = Math.max(1, scaledMeta.width ?? maxProductWidth);
  const scaledHeight = Math.max(1, scaledMeta.height ?? maxProductHeight);

  // 4. Center horizontally & vertically inside reservedBox
  const left = Math.max(
    0,
    Math.min(
      SLIDE_WIDTH - scaledWidth,
      Math.round(reservedBox.x + (reservedBox.width - scaledWidth) / 2),
    ),
  );
  const top = Math.max(
    0,
    Math.min(
      SLIDE_HEIGHT - scaledHeight,
      Math.round(reservedBox.y + (reservedBox.height - scaledHeight) / 2),
    ),
  );

  const placedBox: PlacedProductBox = {
    left,
    top,
    width: scaledWidth,
    height: scaledHeight,
  };

  // 5. Build composite layers: optional soft drop shadow + unmodified scaled cutout
  const shadowEnabled = input.shadow?.enabled ?? true;
  const layers: OverlayOptions[] = [];

  if (shadowEnabled) {
    const shadowLayerBuffer = await buildCanvasShadowLayer({
      scaledCutoutBuffer,
      placedBox,
      offsetX: Math.round(input.shadow?.offsetX ?? 0),
      offsetY: Math.round(input.shadow?.offsetY ?? 18),
      blurSigma: input.shadow?.blurSigma ?? 14,
      opacity: input.shadow?.opacity ?? 0.32,
    });
    layers.push({ input: shadowLayerBuffer, left: 0, top: 0 });
  }

  layers.push({
    input: scaledCutoutBuffer,
    left: placedBox.left,
    top: placedBox.top,
  });

  // 6. Composite onto the 1080x1350 scene deterministically
  const slideBuffer = await sharp(normalizedSceneBuffer)
    .composite(layers)
    .png({ compressionLevel: 6, adaptiveFiltering: false })
    .toBuffer();

  return {
    slideBuffer,
    slideDataUrl: `data:image/png;base64,${slideBuffer.toString("base64")}`,
    scaledCutoutBuffer,
    placedBox,
    reservedBox,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
  };
}

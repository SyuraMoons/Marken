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

export type FramingMode =
  | "full-center"
  | "macro-detail"
  | "offset-left"
  | "offset-right"
  | "floating-hero";

export type DropShadowOptions = {
  /** Whether to render a soft grounding drop shadow behind the product (default: true) */
  enabled?: boolean;
  /** Horizontal shadow offset in pixels (default: 0) */
  offsetX?: number;
  /** Vertical shadow offset in pixels (default: 20) */
  offsetY?: number;
  /** Gaussian blur sigma for the shadow silhouette (default: 14) */
  blurSigma?: number;
  /** Shadow opacity multiplier `[0..1]` (default: 0.36) */
  opacity?: number;
  /** Whether to include a tight dark contact shadow under the product base (default: true) */
  contactShadow?: boolean;
  /** Whether to blend a soft ground reflection under the product on shiny/wet surfaces (default: false) */
  reflection?: boolean;
  /** Whether to cast a subtle ambient light wrap / rim glow matching the scene lighting (default: true) */
  ambientRim?: boolean;
};

export type CompositeProductSlideInput = {
  /** 1080x1350 scene PNG buffer, Uint8Array, or data URL from `generateSlideScene` */
  scene: Buffer | Uint8Array | string;
  /** Confirmed transparent RGBA PNG cutout buffer, Uint8Array, or data URL from `cutoutProduct` */
  cutout: Buffer | Uint8Array | string;
  /** Target empty area on the 1080x1350 canvas (defaults to `DEFAULT_RESERVED_BOX`) */
  reservedBox?: Partial<ReservedBox>;
  /** Dynamic framing mode (macro-detail, offset-left, offset-right, full-center, floating-hero) */
  framingMode?: FramingMode;
  /** Padding ratio inside `reservedBox` on each side (default: 0.06 = 6% breathing room) */
  paddingRatio?: number;
  /** Soft drop shadow and ambient lighting configuration (`FR-CG-09`) */
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
 * Builds an intense, multi-stop contact shadow and ambient occlusion directly under the product base.
 * Physically locks the product to the pedestal / floor surface so it never looks floaty.
 */
async function buildContactShadowLayer(placedBox: PlacedProductBox): Promise<Buffer> {
  const ellipseW = Math.round(placedBox.width * 0.88);
  const ellipseH = Math.max(14, Math.round(placedBox.width * 0.12));
  const cx = Math.round(placedBox.left + placedBox.width / 2);
  const cy = Math.round(placedBox.top + placedBox.height - ellipseH * 0.35);

  const tightW = Math.round(placedBox.width * 0.76);
  const tightH = Math.max(8, Math.round(placedBox.width * 0.06));
  const tightY = Math.round(placedBox.top + placedBox.height - tightH * 0.4);

  const svg = `
    <svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" viewBox="0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="cg_wide" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#0a0503" stop-opacity="0.88"/>
          <stop offset="45%" stop-color="#0f0907" stop-opacity="0.60"/>
          <stop offset="100%" stop-color="#140d0a" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="cg_tight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.95"/>
          <stop offset="60%" stop-color="#050302" stop-opacity="0.75"/>
          <stop offset="100%" stop-color="#0a0503" stop-opacity="0"/>
        </radialGradient>
        <filter id="cblur_wide">
          <feGaussianBlur stdDeviation="8"/>
        </filter>
        <filter id="cblur_tight">
          <feGaussianBlur stdDeviation="3"/>
        </filter>
      </defs>
      <!-- Wide diffuse ground contact shadow -->
      <ellipse cx="${cx}" cy="${cy}" rx="${Math.round(ellipseW / 2)}" ry="${Math.round(ellipseH / 2)}" fill="url(#cg_wide)" filter="url(#cblur_wide)"/>
      <!-- Deep ambient occlusion contact line right at the touch plane -->
      <ellipse cx="${cx}" cy="${tightY}" rx="${Math.round(tightW / 2)}" ry="${Math.round(tightH / 2)}" fill="url(#cg_tight)" filter="url(#cblur_tight)"/>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generates a full-canvas (1080x1350) RGBA soft drop shadow buffer positioned behind the cutout.
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

  const blurredAlpha =
    blurSigma >= 0.5
      ? await sharp(canvasAlpha, {
          raw: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, channels: 1 },
        })
          .blur(blurSigma)
          .extractChannel(0)
          .raw()
          .toBuffer()
      : canvasAlpha;

  // Rich warm shadow tone
  const shadowRgba = Buffer.allocUnsafe(SLIDE_WIDTH * SLIDE_HEIGHT * 4);
  for (let i = 0; i < SLIDE_WIDTH * SLIDE_HEIGHT; i++) {
    const idx = i * 4;
    shadowRgba[idx] = 14;
    shadowRgba[idx + 1] = 10;
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
 * Extracts ambient scene lighting and wraps a soft 2px rim glow around the product perimeter.
 * Eliminates the harsh "pasted cutout" boundary without touching the opaque product pixels.
 */
async function buildAmbientRimLayer(params: {
  sceneBuffer: Buffer;
  scaledCutoutBuffer: Buffer;
  placedBox: PlacedProductBox;
}): Promise<Buffer> {
  const { sceneBuffer, scaledCutoutBuffer, placedBox } = params;

  // 1. Sample ambient background color around the product perimeter
  const sampleX = Math.max(0, placedBox.left - 30);
  const sampleY = Math.max(0, placedBox.top - 30);
  const sampleW = Math.min(SLIDE_WIDTH - sampleX, placedBox.width + 60);
  const sampleH = Math.min(SLIDE_HEIGHT - sampleY, placedBox.height + 60);

  const { channels } = await sharp(sceneBuffer)
    .extract({ left: sampleX, top: sampleY, width: sampleW, height: sampleH })
    .stats();

  const ambR = Math.max(0, Math.min(255, Math.round(channels[0].mean)));
  const ambG = Math.max(0, Math.min(255, Math.round(channels[1].mean)));
  const ambB = Math.max(0, Math.min(255, Math.round(channels[2].mean)));

  // 2. Extract alpha channel from cutout and blur lightly (sigma: 2.2) to create rim mask
  const cutoutAlpha = await sharp(scaledCutoutBuffer)
    .extractChannel(3)
    .blur(2.2)
    .raw()
    .toBuffer();

  // 3. Color rim buffer with the sampled ambient tone at gentle opacity
  const rimRgba = Buffer.allocUnsafe(placedBox.width * placedBox.height * 4);
  for (let i = 0; i < placedBox.width * placedBox.height; i++) {
    const idx = i * 4;
    rimRgba[idx] = ambR;
    rimRgba[idx + 1] = ambG;
    rimRgba[idx + 2] = ambB;
    // Ambient rim opacity wraps softly around edge perimeter
    rimRgba[idx + 3] = Math.round(cutoutAlpha[i] * 0.42);
  }

  return sharp(rimRgba, {
    raw: { width: placedBox.width, height: placedBox.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Builds a subtle ground surface reflection under the base for glossy, wet, or polished surfaces.
 */
async function buildGroundReflectionLayer(
  scaledCutoutBuffer: Buffer,
  placedBox: PlacedProductBox,
): Promise<Buffer> {
  const sliceH = Math.max(16, Math.min(180, Math.round(placedBox.height * 0.24)));
  const bottomSlice = await sharp(scaledCutoutBuffer)
    .extract({
      left: 0,
      top: placedBox.height - sliceH,
      width: placedBox.width,
      height: sliceH,
    })
    .flip()
    .blur(2.5)
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Apply vertical linear decay
  for (let y = 0; y < sliceH; y++) {
    const fade = Math.max(0, 1 - y / sliceH) * 0.24;
    for (let x = 0; x < placedBox.width; x++) {
      const idx = (y * placedBox.width + x) * 4;
      bottomSlice[idx + 3] = Math.round(bottomSlice[idx + 3] * fade);
    }
  }

  const reflImage = await sharp(bottomSlice, {
    raw: { width: placedBox.width, height: sliceH, channels: 4 },
  })
    .png()
    .toBuffer();

  const canvasRefl = Buffer.alloc(SLIDE_WIDTH * SLIDE_HEIGHT * 4, 0);
  const reflRaw = await sharp(reflImage).raw().toBuffer();

  for (let y = 0; y < sliceH; y++) {
    const destY = placedBox.top + placedBox.height + y;
    if (destY >= SLIDE_HEIGHT) continue;
    for (let x = 0; x < placedBox.width; x++) {
      const destX = placedBox.left + x;
      if (destX < 0 || destX >= SLIDE_WIDTH) continue;
      const srcIdx = (y * placedBox.width + x) * 4;
      const dstIdx = (destY * SLIDE_WIDTH + destX) * 4;
      canvasRefl[dstIdx] = reflRaw[srcIdx];
      canvasRefl[dstIdx + 1] = reflRaw[srcIdx + 1];
      canvasRefl[dstIdx + 2] = reflRaw[srcIdx + 2];
      canvasRefl[dstIdx + 3] = reflRaw[srcIdx + 3];
    }
  }

  return sharp(canvasRefl, {
    raw: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Deterministically composites the confirmed product cutout into the reserved area
 * of a 1080x1350 slide scene (`FR-CG-09`).
 */
export async function compositeProductSlide(
  input: CompositeProductSlideInput,
): Promise<CompositeProductSlideResult> {
  const reservedBox = clampReservedBox(input.reservedBox);
  const framingMode: FramingMode = input.framingMode ?? "full-center";
  const paddingRatio =
    typeof input.paddingRatio === "number" &&
    input.paddingRatio >= 0 &&
    input.paddingRatio <= 0.35
      ? input.paddingRatio
      : 0.05;

  const sceneBytes = resolveImageBytes(input.scene);
  const cutoutBytes = resolveImageBytes(input.cutout);

  // 1. Ensure scene is an exact 1080x1350 RGBA canvas
  const normalizedSceneBuffer = await sharp(sceneBytes)
    .resize(SLIDE_WIDTH, SLIDE_HEIGHT, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .png()
    .toBuffer();

  // 2. Compute sizing based on framing mode
  let targetBoxW = reservedBox.width;
  let targetBoxH = reservedBox.height;

  if (framingMode === "macro-detail") {
    // Zoom-in 1.45x for macro detail shot
    targetBoxW = Math.min(SLIDE_WIDTH, Math.round(reservedBox.width * 1.45));
    targetBoxH = Math.min(SLIDE_HEIGHT, Math.round(reservedBox.height * 1.45));
  }

  const padX = Math.round(targetBoxW * paddingRatio);
  const padY = Math.round(targetBoxH * paddingRatio);
  const maxProductWidth = Math.max(64, targetBoxW - padX * 2);
  const maxProductHeight = Math.max(64, targetBoxH - padY * 2);

  // 3. Scale cutout proportionally without distorting aspect ratio
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

  // 4. Compute dynamic placement coordinates according to framing mode
  let left = Math.round(reservedBox.x + (reservedBox.width - scaledWidth) / 2);
  let top = Math.round(reservedBox.y + (reservedBox.height - scaledHeight) / 2);

  if (framingMode === "offset-left") {
    // Dynamic left-side anchoring (Pepsi can style)
    left = Math.max(40, Math.min(180, Math.round(SLIDE_WIDTH * 0.08)));
    top = Math.max(80, Math.min(SLIDE_HEIGHT - scaledHeight - 40, Math.round(reservedBox.y + (reservedBox.height - scaledHeight) * 0.65)));
  } else if (framingMode === "offset-right") {
    // Dynamic right-side anchoring
    left = Math.max(40, SLIDE_WIDTH - scaledWidth - 60);
    top = Math.max(80, Math.min(SLIDE_HEIGHT - scaledHeight - 40, Math.round(reservedBox.y + (reservedBox.height - scaledHeight) * 0.65)));
  } else if (framingMode === "macro-detail") {
    // Position detail zoom
    left = Math.max(0, Math.min(SLIDE_WIDTH - scaledWidth, Math.round(reservedBox.x + (reservedBox.width - scaledWidth) / 2)));
    top = Math.max(0, Math.min(SLIDE_HEIGHT - scaledHeight, Math.round(reservedBox.y + (reservedBox.height - scaledHeight) / 2)));
  } else if (framingMode === "floating-hero") {
    // Elevated product with air underneath (Bella Boom style)
    top = Math.max(60, Math.round(reservedBox.y - 30));
  }

  left = Math.max(0, Math.min(SLIDE_WIDTH - scaledWidth, left));
  top = Math.max(0, Math.min(SLIDE_HEIGHT - scaledHeight, top));

  const placedBox: PlacedProductBox = {
    left,
    top,
    width: scaledWidth,
    height: scaledHeight,
  };

  // 5. Build composite layers deterministically
  const shadowEnabled = input.shadow?.enabled ?? true;
  const layers: OverlayOptions[] = [];

  if (shadowEnabled) {
    // Determine directional shadow offset
    const offX = Math.round(input.shadow?.offsetX ?? (framingMode === "offset-left" ? 18 : 6));
    const offY = Math.round(input.shadow?.offsetY ?? (framingMode === "floating-hero" ? 42 : 22));
    const blur = input.shadow?.blurSigma ?? (framingMode === "floating-hero" ? 22 : 15);
    const op = input.shadow?.opacity ?? (framingMode === "floating-hero" ? 0.24 : 0.38);

    // 1. Diffuse cast shadow
    const shadowLayerBuffer = await buildCanvasShadowLayer({
      scaledCutoutBuffer,
      placedBox,
      offsetX: offX,
      offsetY: offY,
      blurSigma: blur,
      opacity: op,
    });
    layers.push({ input: shadowLayerBuffer, left: 0, top: 0 });

    // 2. Realistic tight contact shadow anchoring base
    if (input.shadow?.contactShadow !== false && framingMode !== "floating-hero") {
      const contactBuffer = await buildContactShadowLayer(placedBox);
      layers.push({ input: contactBuffer, left: 0, top: 0 });
    }

    // 3. Optional ground reflection for glossy/wet/polished surfaces
    if (input.shadow?.reflection) {
      const reflBuffer = await buildGroundReflectionLayer(scaledCutoutBuffer, placedBox);
      layers.push({ input: reflBuffer, left: 0, top: 0 });
    }
  }

  // 4. Soft ambient rim light wrap bridging background lighting into product edges
  if (input.shadow?.ambientRim !== false) {
    const rimBuffer = await buildAmbientRimLayer({
      sceneBuffer: normalizedSceneBuffer,
      scaledCutoutBuffer,
      placedBox,
    });
    layers.push({ input: rimBuffer, left: placedBox.left, top: placedBox.top });
  }

  // 5. Confirmed product cutout placed exactly at placedBox
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

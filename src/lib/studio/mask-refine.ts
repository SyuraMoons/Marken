// Deterministic mask clean-up for the product cutout (FR-SP-09).
// Pure raster functions plus two `sharp` helpers: soft alpha edges and edge colour
// decontamination. Nothing here calls a model, and product pixels are only ever
// copied, never regenerated (FR-CG-09).

import sharp from "sharp";

/** Components smaller than this share of the largest one are dropped as speckles. */
const MIN_COMPONENT_SHARE = 0.03;
/** Enclosed holes up to this share of the product are filled (specular highlights, dust). */
const MAX_FILLED_HOLE_SHARE = 0.004;
const MIN_FILLED_HOLE_AREA = 24;

export type MaskStats = {
  /** Foreground pixels after refinement */
  foreground: number;
  /** Kept components other than the largest one */
  secondaryComponents: number;
  /** Area of kept secondary components relative to the largest component */
  secondaryAreaRatio: number;
  /** Area of enclosed holes left open (handles, loops) relative to foreground plus holes */
  openHoleRatio: number;
  filledHoles: number;
};

export type RefinedMask = { mask: Uint8Array; stats: MaskStats };

type Labeled = { labels: Int32Array; sizes: number[] };

/** Labels connected regions of `value` pixels. Label 0 is reserved for "other". */
function labelComponents(
  raster: Uint8Array,
  width: number,
  height: number,
  value: 0 | 1,
  eightConnected: boolean,
): Labeled {
  const labels = new Int32Array(width * height);
  const sizes: number[] = [0];
  const queue = new Int32Array(width * height);
  let next = 1;

  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== 0 || raster[start] !== value) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = next;
    let size = 0;
    while (head < tail) {
      const idx = queue[head++];
      size++;
      const x = idx % width;
      const y = (idx - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (!eightConnected && dx !== 0 && dy !== 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (labels[n] === 0 && raster[n] === value) {
            labels[n] = next;
            queue[tail++] = n;
          }
        }
      }
    }
    sizes.push(size);
    next++;
  }
  return { labels, sizes };
}

/**
 * Keeps the product body (plus any substantial secondary part), drops speckles, fills
 * small enclosed holes, and leaves large enclosed holes open so a handle or loop stays
 * see-through instead of showing the old background.
 */
export function refineMaskRaster(
  raster01: Uint8Array,
  width: number,
  height: number,
): RefinedMask {
  const total = width * height;
  const out = new Uint8Array(total);

  const fg = labelComponents(raster01, width, height, 1, true);
  let largest = 0;
  for (let i = 1; i < fg.sizes.length; i++) {
    if (fg.sizes[i] > (fg.sizes[largest] ?? 0)) largest = i;
  }
  const largestSize = fg.sizes[largest] ?? 0;
  const kept = new Set<number>();
  let secondaryComponents = 0;
  let secondaryArea = 0;
  for (let i = 1; i < fg.sizes.length; i++) {
    if (i === largest || fg.sizes[i] >= largestSize * MIN_COMPONENT_SHARE) {
      kept.add(i);
      if (i !== largest) {
        secondaryComponents++;
        secondaryArea += fg.sizes[i];
      }
    }
  }
  let foreground = 0;
  for (let i = 0; i < total; i++) {
    if (kept.has(fg.labels[i])) {
      out[i] = 1;
      foreground++;
    }
  }

  // Holes: background regions that never reach the border
  const bg = labelComponents(out, width, height, 0, false);
  const exterior = new Set<number>();
  for (let x = 0; x < width; x++) {
    exterior.add(bg.labels[x]);
    exterior.add(bg.labels[(height - 1) * width + x]);
  }
  for (let y = 0; y < height; y++) {
    exterior.add(bg.labels[y * width]);
    exterior.add(bg.labels[y * width + width - 1]);
  }
  const fillLimit = Math.max(MIN_FILLED_HOLE_AREA, foreground * MAX_FILLED_HOLE_SHARE);
  const fill = new Set<number>();
  let openHoleArea = 0;
  let filledHoles = 0;
  for (let i = 1; i < bg.sizes.length; i++) {
    if (exterior.has(i)) continue;
    if (bg.sizes[i] <= fillLimit) {
      fill.add(i);
      filledHoles++;
    } else {
      openHoleArea += bg.sizes[i];
    }
  }
  if (fill.size > 0) {
    for (let i = 0; i < total; i++) {
      if (out[i] === 0 && fill.has(bg.labels[i])) {
        out[i] = 1;
        foreground++;
      }
    }
  }

  return {
    mask: out,
    stats: {
      foreground,
      secondaryComponents,
      secondaryAreaRatio: largestSize > 0 ? secondaryArea / largestSize : 0,
      openHoleRatio: foreground + openHoleArea > 0 ? openHoleArea / (foreground + openHoleArea) : 0,
      filledHoles,
    },
  };
}

// Alpha ramp: pixels below LOW vanish and above HIGH are solid. Centring it above 128
// pulls the edge in by roughly a pixel, which drops the mixed background pixels.
const RAMP_LOW = 110;
const RAMP_HIGH = 215;
const RAMP = (() => {
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    const t = Math.min(1, Math.max(0, (v - RAMP_LOW) / (RAMP_HIGH - RAMP_LOW)));
    lut[v] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  return lut;
})();

/**
 * Turns a binary mask into a soft, anti-aliased alpha channel at `outWidth` x `outHeight`.
 * The mask is upscaled as greyscale (not nearest neighbour) so the edge stays smooth.
 */
export async function rasterToSoftAlpha(
  mask: Uint8Array,
  width: number,
  height: number,
  outWidth: number,
  outHeight: number,
): Promise<Buffer> {
  const gray = Buffer.allocUnsafe(mask.length);
  for (let i = 0; i < mask.length; i++) gray[i] = mask[i] ? 255 : 0;

  let img = sharp(gray, { raw: { width, height, channels: 1 } });
  if (width !== outWidth || height !== outHeight) {
    img = img.resize(outWidth, outHeight, { fit: "fill", kernel: "cubic" });
  }
  // sharp returns 3 channels for 1-channel raw input after resize/blur, so keep one
  const soft = await img.blur(1).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < soft.length; i++) soft[i] = RAMP[soft[i]];
  return soft;
}

/**
 * Replaces the colour of semi-transparent edge pixels with the nearest solid interior
 * colour, so no wall or table colour bleeds into the rim when the cutout is composited.
 * Returns new RGB bytes; alpha is untouched.
 */
export async function decontaminateEdges(
  rgb: Buffer,
  alpha: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const pixels = width * height;

  // Interior = pixels whose whole neighbourhood is opaque (alpha blurred still ~255)
  const nearAlpha = await sharp(alpha, { raw: { width, height, channels: 1 } })
    .blur(2)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const weight = Buffer.allocUnsafe(pixels);
  const weighted = Buffer.allocUnsafe(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    const w = alpha[i] === 255 && nearAlpha[i] >= 250 ? 255 : 0;
    weight[i] = w;
    const o = i * 3;
    weighted[o] = w ? rgb[o] : 0;
    weighted[o + 1] = w ? rgb[o + 1] : 0;
    weighted[o + 2] = w ? rgb[o + 2] : 0;
  }

  const SIGMA = 4;
  const blurredWeight = await sharp(weight, { raw: { width, height, channels: 1 } })
    .blur(SIGMA)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const blurredColor = await sharp(weighted, { raw: { width, height, channels: 3 } })
    .blur(SIGMA)
    .raw()
    .toBuffer();

  const out = Buffer.from(rgb);
  for (let i = 0; i < pixels; i++) {
    if (alpha[i] === 255) continue;
    const w = blurredWeight[i];
    if (w < 24) continue; // too far from solid pixels to estimate a colour
    const o = i * 3;
    for (let c = 0; c < 3; c++) {
      out[o + c] = Math.min(255, Math.round((blurredColor[o + c] * 255) / w));
    }
  }
  return out;
}


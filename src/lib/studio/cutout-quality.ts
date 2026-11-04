// Quality gate for a product cutout (FR-SP-09). A bad mask must fail visibly here,
// before it becomes a poster, instead of being pasted onto a scene.

import type { MaskStats } from "./mask-refine";

export type CutoutReasonCode =
  | "too_small"
  | "too_large"
  | "sparse_mask"
  | "box_like"
  | "fragmented"
  | "ragged"
  | "cropped_product"
  | "holey";

export type CutoutMetrics = {
  /** Mask box area relative to the whole photo */
  boxAreaRatio: number;
  /** Foreground share of the mask box */
  fillRatio: number;
  /** Foreground area over its convex hull area */
  solidity: number;
  /** Share of the mask box perimeter where the product runs off the photo edge */
  borderTouchRatio: number;
  secondaryAreaRatio: number;
  openHoleRatio: number;
};

export type CutoutAssessment = {
  ok: boolean;
  reasons: CutoutReasonCode[];
  metrics: CutoutMetrics;
};

export const CUTOUT_THRESHOLDS = {
  minBoxArea: 0.03,
  maxBoxArea: 0.95,
  minFill: 0.25,
  maxFill: 0.98,
  maxSecondaryArea: 0.15,
  minSolidity: 0.45,
  maxBorderTouch: 0.15,
  maxOpenHole: 0.25,
} as const;

/** Owner-facing hint per failure, for the UI to show next to the re-upload prompt. */
export const CUTOUT_REASON_HINTS: Record<CutoutReasonCode, string> = {
  too_small: "The product is too small in the photo. Move closer.",
  too_large: "The product fills the whole photo. Step back so the background shows.",
  sparse_mask: "We could not see the product clearly. Try a plainer background.",
  box_like: "We could not separate the product from the background. Try a contrasting backdrop.",
  fragmented: "Several objects were picked up. Photograph the product alone.",
  ragged: "The outline came out uneven. Use even lighting and a plain backdrop.",
  cropped_product: "The product is cut off at the photo edge. Keep it fully in frame.",
  holey: "Parts of the product were missed. Try brighter, even lighting.",
};

type Point = { x: number; y: number };

function convexHullArea(points: Point[]): number {
  if (points.length < 3) return 0;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export type AssessCutoutInput = {
  /** Refined mask raster (0 | 1), covering the SAM box */
  mask: Uint8Array;
  width: number;
  height: number;
  stats: MaskStats;
  /** SAM box (inclusive x2, y2) and the frame it was measured in */
  pixelBox: { x1: number; y1: number; x2: number; y2: number; w: number; h: number };
};

export function assessCutout(input: AssessCutoutInput): CutoutAssessment {
  const { mask, width, height, stats, pixelBox } = input;
  const T = CUTOUT_THRESHOLDS;

  const boxW = pixelBox.x2 - pixelBox.x1 + 1;
  const boxH = pixelBox.y2 - pixelBox.y1 + 1;
  const boxAreaRatio = (boxW * boxH) / Math.max(1, pixelBox.w * pixelBox.h);
  const fillRatio = stats.foreground / Math.max(1, width * height);

  // Convex hull from the left and right extreme of every row
  const points: Point[] = [];
  for (let y = 0; y < height; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left >= 0) {
      points.push({ x: left, y }, { x: right + 1, y: y + 1 });
      points.push({ x: right + 1, y }, { x: left, y: y + 1 });
    }
  }
  const hullArea = convexHullArea(points);
  const solidity = hullArea > 0 ? Math.min(1, stats.foreground / hullArea) : 0;

  // Product running off the photo edge: mask pixels on a box side that sits on the frame edge
  let touching = 0;
  if (pixelBox.x1 <= 1) for (let y = 0; y < height; y++) touching += mask[y * width];
  if (pixelBox.x2 >= pixelBox.w - 2) for (let y = 0; y < height; y++) touching += mask[y * width + width - 1];
  if (pixelBox.y1 <= 1) for (let x = 0; x < width; x++) touching += mask[x];
  if (pixelBox.y2 >= pixelBox.h - 2) for (let x = 0; x < width; x++) touching += mask[(height - 1) * width + x];
  const borderTouchRatio = touching / Math.max(1, 2 * (width + height));

  const metrics: CutoutMetrics = {
    boxAreaRatio,
    fillRatio,
    solidity,
    borderTouchRatio,
    secondaryAreaRatio: stats.secondaryAreaRatio,
    openHoleRatio: stats.openHoleRatio,
  };

  const reasons: CutoutReasonCode[] = [];
  if (boxAreaRatio < T.minBoxArea) reasons.push("too_small");
  if (boxAreaRatio > T.maxBoxArea) reasons.push("too_large");
  if (fillRatio < T.minFill) reasons.push("sparse_mask");
  if (fillRatio > T.maxFill) reasons.push("box_like");
  if (stats.secondaryAreaRatio > T.maxSecondaryArea) reasons.push("fragmented");
  if (solidity < T.minSolidity) reasons.push("ragged");
  if (borderTouchRatio > T.maxBorderTouch) reasons.push("cropped_product");
  if (stats.openHoleRatio > T.maxOpenHole) reasons.push("holey");

  return { ok: reasons.length === 0, reasons, metrics };
}


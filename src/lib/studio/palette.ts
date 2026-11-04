// Deterministic product palette extractor & color harmony generator (FR-CG-04, FR-SP-04).
// Reads pixels from the confirmed cutout buffer, extracts dominant hue/saturation,
// and derives high-contrast accent & background colors matching contemporary poster aesthetics (e.g. BLU reference).

import sharp from "sharp";

export type ProductPalette = {
  /** Dominant product hex color (e.g. #5a2672 for purple bottle) */
  dominant: string;
  /** Complementary or split-complementary high-contrast accent (e.g. vibrant lime, cyan, or hot pink) */
  accent: string;
  /** Harmonious supporting color (lighter or darker tone) */
  secondary: string;
  /** Clean light neutral background tint (e.g. off-white, light icy blue, soft cream) */
  lightNeutral: string;
  /** Deep dark contrast color for bold typography */
  darkNeutral: string;
};

// RGB to HSL helpers
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h = (h % 360 + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Extracts the dominant color from opaque product pixels and creates a vibrant commercial palette.
 */
export async function extractProductPalette(cutoutBuffer: Buffer): Promise<ProductPalette> {
  const { data } = await sharp(cutoutBuffer)
    .resize(120, 120, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets: Map<string, { count: number; rSum: number; gSum: number; bSum: number }> = new Map();

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue; // skip transparent / edge pixels

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Quantize to 24-step buckets
    const qr = Math.round(r / 24) * 24;
    const qg = Math.round(g / 24) * 24;
    const qb = Math.round(b / 24) * 24;
    const key = `${qr},${qg},${qb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      existing.rSum += r;
      existing.gSum += g;
      existing.bSum += b;
    } else {
      buckets.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
    }
  }

  // Find the true product color (strongly penalize near-black and near-white)
  let bestBucket = { count: 0, r: 128, g: 128, b: 128 };
  let bestScore = -1;

  for (const b of buckets.values()) {
    const avgR = Math.round(b.rSum / b.count);
    const avgG = Math.round(b.gSum / b.count);
    const avgB = Math.round(b.bSum / b.count);
    const [, s, l] = rgbToHsl(avgR, avgG, avgB);

    // Filter out extreme shadows (l < 12) and extreme highlights (l > 95)
    // and give strong weight to actual chromatic saturation
    if (l < 12 || l > 95) continue;

    const chromaWeight = Math.pow(Math.max(1, s), 1.6);
    const lightnessWeight = 1 - Math.abs(l - 50) / 60;
    const score = b.count * chromaWeight * lightnessWeight;

    if (score > bestScore) {
      bestScore = score;
      bestBucket = { count: b.count, r: avgR, g: avgG, b: avgB };
    }
  }

  // Fallback if the product is genuinely black or white
  if (bestScore === -1 && buckets.size > 0) {
    let maxCount = -1;
    for (const b of buckets.values()) {
      if (b.count > maxCount) {
        maxCount = b.count;
        bestBucket = { count: b.count, r: Math.round(b.rSum / b.count), g: Math.round(b.gSum / b.count), b: Math.round(b.bSum / b.count) };
      }
    }
  }

  const [domH, domS, domL] = rgbToHsl(bestBucket.r, bestBucket.g, bestBucket.b);
  const dominant = hslToHex(domH, Math.max(35, domS), Math.max(25, Math.min(65, domL)));

  // Derive high-contrast, trendy poster colors:
  // Complementary (+180 deg) or Split-Complementary
  const compH = (domH + 180) % 360;
  const accent = hslToHex(compH, 90, 52); // vibrant accent

  // Vibrant secondary: analogous (+45 deg)
  const secH = (domH + 45) % 360;
  const secondary = hslToHex(secH, 80, 50);

  // Clean neutrals with subtle hue casting for cohesive look
  const lightNeutral = hslToHex(compH, 15, 96); // tinted off-white
  const darkNeutral = hslToHex(domH, 35, 12); // deep dark charcoal with product undertone

  return {
    dominant,
    accent,
    secondary,
    lightNeutral,
    darkNeutral,
  };
}

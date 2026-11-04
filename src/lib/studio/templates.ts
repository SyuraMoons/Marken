// Contemporary commercial poster templates (inspired by high-performance social creative like BLU).
// Provides deterministic typography, color card blocks, and product positioning.

import {
  CANVAS_H,
  CANVAS_W,
  defaultTextBox,
  fitFontSize,
  MAX_TEXT_SIZE,
  type Box,
  type FontId,
  type SlideBackground,
  type SlideLayers,
  type TemplateId,
  type TextLayer,
} from "./layers";
import type { ProductPalette } from "./palette";

export type { TemplateId } from "./layers";
export type PostCategory = "product-highlight" | "product-poster" | "product-with-name";

/** Templates whose headline sits on a drawn card or banner, so its colour is fixed by the template. */
export const TEMPLATES_WITH_TEXT_ON_SHAPE: ReadonlySet<TemplateId> = new Set(["color-block", "product-poster", "tilted-hero"]);

export type TemplateInput = {
  templateId: TemplateId;
  sceneBrief: string;
  headline: string;
  subline?: string;
  cta?: string;
  bigWord?: string;
  palette: ProductPalette;
  productBox?: Partial<Box>;
  fontHeading?: FontId;
  fontBody?: FontId;
};

/**
 * Creates SVG for background graphic shapes (cards, pills, blocks) matching the template style.
 */
export function buildTemplateBackgroundShapes(
  templateId: TemplateId,
  palette: Pick<ProductPalette, "dominant" | "accent">,
): Buffer | null {
  if (templateId === "color-block" || templateId === "product-poster") {
    // Large stylish rounded rectangular card in the upper portion of the canvas (BLU style)
    const cardSvg = `
      <svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="80" y="100" width="920" height="420" rx="40" fill="${palette.dominant}" />
        <!-- Subtle accent border or inner glow -->
        <rect x="82" y="102" width="916" height="416" rx="38" fill="none" stroke="${palette.accent}" stroke-width="3" opacity="0.4"/>
      </svg>
    `;
    return Buffer.from(cardSvg);
  }

  if (templateId === "tilted-hero") {
    // Dynamic angled geometric banner behind the product
    const bannerSvg = `
      <svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="0,320 ${CANVAS_W},180 ${CANVAS_W},680 0,820" fill="${palette.dominant}" opacity="0.9" />
        <polygon points="0,335 ${CANVAS_W},195 ${CANVAS_W},355 0,495" fill="${palette.accent}" opacity="0.3" />
      </svg>
    `;
    return Buffer.from(bannerSvg);
  }

  return null;
}

/**
 * Applies a contemporary template to generate ready-to-render SlideLayers.
 */
/** The colours a template's graphics need, stored on the layers so edits redraw them. */
export function templateBackground(templateId: TemplateId, palette: ProductPalette): SlideBackground | undefined {
  return buildTemplateBackgroundShapes(templateId, palette)
    ? { template: templateId, dominant: palette.dominant, accent: palette.accent }
    : undefined;
}

export function applyTemplateLayout(input: TemplateInput): SlideLayers {
  const { templateId, sceneBrief, headline, subline, cta, bigWord, palette } = input;
  const fontH: FontId = input.fontHeading ?? (templateId === "big-type-behind" ? "bebas" : "poppins-bold");
  const fontB: FontId = input.fontBody ?? "poppins";

  const textLayers: TextLayer[] = [];

  // Default product box centred in the lower-middle half
  let productBox: Box = {
    x: 240,
    y: 350,
    width: 600,
    height: 850,
  };

  switch (templateId) {
    case "product-highlight": {
      // Category 1: Product Highlight (Text-Free Aesthetic)
      // Pure product immersion interacting with the stylized luxury environment/podium.
      // Strictly no overlaid text, no logos, no CTA.
      productBox = { x: 220, y: 260, width: 640, height: 920 };
      break;
    }

    case "product-with-name": {
      // Category 3: Product with Name (Minimalist Identification)
      // Balanced layout stating strictly the identifying brand, collaboration, or model name.
      // E.g. "MAISON MARGIELA - GENTLE MONSTER" or "HYDRO FLASK"
      const brandOrName = (headline || bigWord || "BRAND PRODUCT").toUpperCase();
      const nBox: Box = { x: 80, y: 80, width: 920, height: 90 };
      const chosenFont: FontId = input.fontHeading ?? "dm-serif";
      textLayers.push({
        id: "brand-name",
        role: "headline",
        text: brandOrName,
        box: nBox,
        font: chosenFont,
        size: fitFontSize(brandOrName, chosenFont, nBox, 54),
        color: palette.darkNeutral,
        align: "center",
      });
      productBox = { x: 250, y: 280, width: 580, height: 900 };
      break;
    }

    case "product-poster": {
      // Category 2: Product Poster (Campaign & Messaging - Stanley / BLU style)
      // Graphic-heavy layout with prominent campaign headline, brand block, and punchline.
      const cardTextBox: Box = { x: 100, y: 120, width: 880, height: 260 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline.toUpperCase(),
        box: cardTextBox,
        font: fontH,
        size: fitFontSize(headline.toUpperCase(), fontH, cardTextBox, 88),
        color: "#ffffff",
        align: "center",
      });

      if (subline) {
        const subBox: Box = { x: 120, y: 390, width: 840, height: 90 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline.toUpperCase(),
          box: subBox,
          font: "bebas",
          size: fitFontSize(subline.toUpperCase(), "bebas", subBox, 48),
          color: palette.accent,
          align: "center",
        });
      }

      if (cta) {
        const ctaBox: Box = { x: 100, y: 1210, width: 880, height: 80 };
        textLayers.push({
          id: "cta",
          role: "cta",
          text: cta,
          box: ctaBox,
          font: "poppins-bold",
          size: fitFontSize(cta, "poppins-bold", ctaBox, 34),
          color: palette.darkNeutral,
          align: "center",
        });
      }

      productBox = { x: 250, y: 440, width: 580, height: 760 };
      break;
    }

    case "big-type-behind": {
      // 1. Giant typography word behind product (BLU "BLU?" style)
      // E.g. "COLD", "PURE", "HYDRO" - spans broadly across the upper body
      // Whole word, never cut: long words get a smaller size instead.
      const keyword = (bigWord || headline.split(" ")[0] || "COLD").toUpperCase();
      const bgTextBox: Box = { x: 20, y: 190, width: 1040, height: 420 };
      const calcSize = fitFontSize(keyword, "bebas", bgTextBox, MAX_TEXT_SIZE);
      // Use vibrant neon/accent color from palette or hot contrast
      const bgWordColor = palette.accent;
      textLayers.push({
        id: "big-type-behind",
        role: "headline",
        text: keyword,
        box: bgTextBox,
        font: "bebas",
        size: calcSize,
        color: bgWordColor,
        align: "center",
      });

      // 2. High-contrast headline on top
      if (headline) {
        const hBox: Box = { x: 90, y: 70, width: 900, height: 110 };
        textLayers.push({
          id: "headline",
          role: "headline",
          text: headline.toUpperCase(),
          box: hBox,
          font: fontH,
          size: fitFontSize(headline.toUpperCase(), fontH, hBox, 64),
          color: "#ffffff",
          align: "center",
        });
      }

      // 3. Subline or CTA near the bottom/flank
      if (subline || cta) {
        const text = (subline || cta)!.trim();
        const bBox: Box = { x: 100, y: 1180, width: 880, height: 100 };
        textLayers.push({
          id: "subline",
          role: "body",
          text,
          box: bBox,
          font: fontB,
          size: fitFontSize(text, fontB, bBox, 40),
          color: palette.lightNeutral,
          align: "center",
        });
      }

      productBox = { x: 260, y: 320, width: 560, height: 860 };
      break;
    }

    case "color-block": {
      // Top color card holds the main headline & subline
      const cardTextBox: Box = { x: 130, y: 140, width: 820, height: 240 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline,
        box: cardTextBox,
        font: fontH,
        size: fitFontSize(headline, fontH, cardTextBox, 78),
        color: "#ffffff",
        align: "center",
      });

      if (subline) {
        const subBox: Box = { x: 140, y: 370, width: 800, height: 100 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline,
          box: subBox,
          font: fontB,
          size: fitFontSize(subline, fontB, subBox, 36),
          color: palette.accent,
          align: "center",
        });
      }

      if (cta) {
        const ctaBox: Box = { x: 100, y: 1220, width: 880, height: 70 };
        textLayers.push({
          id: "cta",
          role: "cta",
          text: cta,
          box: ctaBox,
          font: "poppins-bold",
          size: fitFontSize(cta, "poppins-bold", ctaBox, 34),
          color: palette.darkNeutral,
          align: "center",
        });
      }

      // Product overlaps the bottom border of the card
      productBox = { x: 240, y: 440, width: 600, height: 760 };
      break;
    }

    case "tilted-hero": {
      // Dynamic bold diagonal banner
      const hBox: Box = { x: 80, y: 220, width: 920, height: 180 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline.toUpperCase(),
        box: hBox,
        font: "bebas",
        size: fitFontSize(headline.toUpperCase(), "bebas", hBox, 110),
        color: "#ffffff",
        align: "left",
      });

      if (subline) {
        const subBox: Box = { x: 80, y: 410, width: 700, height: 90 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline,
          box: subBox,
          font: fontB,
          size: fitFontSize(subline, fontB, subBox, 38),
          color: palette.accent,
          align: "left",
        });
      }

      if (cta) {
        const ctaBox: Box = { x: 80, y: 1200, width: 920, height: 80 };
        textLayers.push({
          id: "cta",
          role: "cta",
          text: cta,
          box: ctaBox,
          font: "poppins-bold",
          size: fitFontSize(cta, "poppins-bold", ctaBox, 36),
          color: palette.darkNeutral,
          align: "center",
        });
      }

      productBox = { x: 340, y: 420, width: 540, height: 780 };
      break;
    }

    case "pedestal-hero":
    default: {
      // Clean high-impact headline on top
      const hBox: Box = { x: 90, y: 90, width: 900, height: 180 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline,
        box: hBox,
        font: fontH,
        size: fitFontSize(headline, fontH, hBox, 84),
        color: palette.darkNeutral,
        align: "center",
      });

      if (subline) {
        const sBox: Box = { x: 100, y: 270, width: 880, height: 90 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline,
          box: sBox,
          font: fontB,
          size: fitFontSize(subline, fontB, sBox, 40),
          color: palette.dominant,
          align: "center",
        });
      }

      if (cta) {
        const cBox = defaultTextBox("cta");
        textLayers.push({
          id: "cta",
          role: "cta",
          text: cta,
          box: cBox,
          font: "poppins-bold",
          size: fitFontSize(cta, "poppins-bold", cBox, 36),
          color: palette.darkNeutral,
          align: "center",
        });
      }

      productBox = { x: 270, y: 360, width: 540, height: 820 };
      break;
    }
  }

  // Override product box if caller specified custom dimensions
  if (input.productBox) {
    productBox = { ...productBox, ...input.productBox };
  }

  const background = templateBackground(templateId, palette);
  return {
    sceneBrief,
    product: { box: productBox },
    text: textLayers,
    ...(background ? { background } : {}),
  };
}

// Contemporary commercial poster templates.
// Provides deterministic typography, brand color integration, and dynamic product positioning.
// STRICT RULE (Evaluation #1): NO opaque box background behind titles. Clean text directly on background.

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
export const TEMPLATES_WITH_TEXT_ON_SHAPE: ReadonlySet<TemplateId> = new Set(["color-block", "tilted-hero"]);

export type TemplateInput = {
  templateId: TemplateId;
  sceneBrief: string;
  headline: string;
  subline?: string;
  cta?: string;
  bigWord?: string;
  categoryTag?: string;
  palette: ProductPalette;
  productBox?: Partial<Box>;
  fontHeading?: FontId;
  fontBody?: FontId;
};

/** Templates that draw a CTA pill under the call to action text. */
const TEMPLATES_WITH_CTA_PILL: ReadonlySet<TemplateId> = new Set(["tech-hero", "product-poster"]);

/**
 * Creates SVG for background graphic shapes.
 * New layouts put titles straight on the scene; only color-block and tilted-hero keep a shape
 * behind the text, and tech-hero / product-poster draw a CTA pill when `hasCta` is set.
 */
export function buildTemplateBackgroundShapes(
  templateId: TemplateId,
  palette: Pick<ProductPalette, "dominant" | "accent">,
  hasCta: boolean = false,
): Buffer | null {
  if (templateId === "color-block") {
    const cardSvg = `
      <svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="80" y="100" width="920" height="420" rx="40" fill="${palette.dominant}" />
      </svg>
    `;
    return Buffer.from(cardSvg);
  }

  if (templateId === "product-poster" && !hasCta) {
    // Posts saved before the no-card redesign stored this background with white text on the card.
    // New product-poster layouts only store a background when they draw the CTA pill.
    const legacyCardSvg = `
      <svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="80" y="100" width="920" height="420" rx="40" fill="${palette.dominant}" />
        <rect x="82" y="102" width="916" height="416" rx="38" fill="none" stroke="${palette.accent}" stroke-width="3" opacity="0.4"/>
      </svg>
    `;
    return Buffer.from(legacyCardSvg);
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

  if (hasCta && TEMPLATES_WITH_CTA_PILL.has(templateId)) {
    // Elegant pill button at bottom strictly when a CTA is requested
    const pillSvg = `
      <svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cta_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${palette.dominant}" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0.95"/>
          </linearGradient>
        </defs>
        <rect x="290" y="1195" width="500" height="74" rx="37" fill="url(#cta_grad)"/>
        <rect x="291" y="1196" width="498" height="72" rx="36" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.35"/>
      </svg>
    `;
    return Buffer.from(pillSvg);
  }

  return null;
}

/**
 * Applies a contemporary template to generate ready-to-render SlideLayers.
 */
/** The colours a template's graphics need, stored on the layers so edits redraw them. */
export function templateBackground(
  templateId: TemplateId,
  palette: ProductPalette,
  hasCta: boolean = false,
): SlideBackground | undefined {
  const base = { template: templateId, dominant: palette.dominant, accent: palette.accent };
  if (templateId === "color-block" || templateId === "tilted-hero") return base;
  if (hasCta && TEMPLATES_WITH_CTA_PILL.has(templateId)) return { ...base, cta: true };
  return undefined;
}

export function applyTemplateLayout(input: TemplateInput): SlideLayers {
  const { templateId, sceneBrief, headline, subline, cta, bigWord, categoryTag, palette } = input;
  const fontH: FontId = input.fontHeading ?? (templateId === "tech-hero" ? "space-grotesk-bold" : "montserrat-bold");
  const fontB: FontId = input.fontBody ?? (templateId === "tech-hero" ? "montserrat" : "poppins");

  const textLayers: TextLayer[] = [];

  // Default product box centered in lower-middle half
  let productBox: Box = {
    x: 240,
    y: 380,
    width: 600,
    height: 820,
  };

  switch (templateId) {
    case "offset-editorial": {
      // Inspired by Pepsi top-down / high-angle ad:
      // Product anchored on left side, clean punchy typography top-left / left
      const hBox: Box = { x: 80, y: 80, width: 720, height: 190 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline.toUpperCase(),
        box: hBox,
        font: fontH,
        size: fitFontSize(headline.toUpperCase(), fontH, hBox, 92),
        color: "#ffffff",
        align: "left",
      });

      if (subline) {
        const sBox: Box = { x: 80, y: 280, width: 700, height: 90 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline.toUpperCase(),
          box: sBox,
          font: fontB,
          size: fitFontSize(subline.toUpperCase(), fontB, sBox, 44),
          color: palette.accent || "#e0e0e0",
          align: "left",
        });
      }

      if (cta) {
        const cBox: Box = { x: 80, y: 1220, width: 920, height: 70 };
        textLayers.push({
          id: "cta",
          role: "cta",
          text: cta,
          box: cBox,
          font: "montserrat-bold",
          size: fitFontSize(cta, "montserrat-bold", cBox, 34),
          color: "#ffffff",
          align: "left",
        });
      }

      // Off-center product on lower left
      productBox = { x: 70, y: 400, width: 560, height: 870 };
      break;
    }

    case "tech-hero": {
      // Tag at top + Hero title + 1-sentence value prop + CTA pill button.
      // The tag comes from the planner in the shop's content language; no hard-coded fallback.
      const tagText = categoryTag?.trim().toUpperCase();
      if (tagText) {
        const tagBox: Box = { x: 100, y: 70, width: 880, height: 50 };
        textLayers.push({
          id: "tag",
          role: "headline",
          text: tagText,
          box: tagBox,
          font: "space-grotesk",
          size: fitFontSize(tagText, "space-grotesk", tagBox, 32),
          color: palette.accent || "#ff7a45",
          align: "center",
        });
      }

      const hBox: Box = { x: 90, y: 130, width: 900, height: 160 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline,
        box: hBox,
        font: fontH,
        size: fitFontSize(headline, fontH, hBox, 86),
        color: "#ffffff",
        align: "center",
      });

      if (subline) {
        const sBox: Box = { x: 120, y: 300, width: 840, height: 100 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline,
          box: sBox,
          font: fontB,
          size: fitFontSize(subline, fontB, sBox, 38),
          color: "#d4d4d8",
          align: "center",
        });
      }

      if (cta && cta.trim()) {
        const cBox: Box = { x: 300, y: 1200, width: 480, height: 64 };
        textLayers.push({
          id: "cta",
          role: "cta",
          text: cta.trim(),
          box: cBox,
          font: "montserrat-bold",
          size: fitFontSize(cta.trim(), "montserrat-bold", cBox, 32),
          color: "#ffffff",
          align: "center",
        });
      }

      productBox = { x: 220, y: 410, width: 640, height: 760 };
      break;
    }

    case "macro-detail": {
      // Close-up detail shot with clean minimal copy
      const hBox: Box = { x: 80, y: 70, width: 920, height: 150 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline.toUpperCase(),
        box: hBox,
        font: fontH,
        size: fitFontSize(headline.toUpperCase(), fontH, hBox, 80),
        color: "#ffffff",
        align: "center",
      });

      if (subline) {
        const sBox: Box = { x: 80, y: 1230, width: 920, height: 60 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline,
          box: sBox,
          font: fontB,
          size: fitFontSize(subline, fontB, sBox, 34),
          color: "#f4f4f5",
          align: "center",
        });
      }

      // Large macro crop box
      productBox = { x: 140, y: 220, width: 800, height: 1000 };
      break;
    }

    case "product-highlight": {
      // Text-Free pure product immersion
      productBox = { x: 200, y: 250, width: 680, height: 940 };
      break;
    }

    case "product-with-name": {
      // Minimalist Identification (e.g. "HYDRO FLASK" or "PEPSI ZERO SUGAR")
      const brandOrName = (headline || bigWord || "PRODUCT").toUpperCase();
      const nBox: Box = { x: 80, y: 80, width: 920, height: 90 };
      const chosenFont: FontId = input.fontHeading ?? "dm-serif";
      textLayers.push({
        id: "brand-name",
        role: "headline",
        text: brandOrName,
        box: nBox,
        font: chosenFont,
        size: fitFontSize(brandOrName, chosenFont, nBox, 56),
        color: "#ffffff",
        align: "center",
      });
      productBox = { x: 250, y: 260, width: 580, height: 920 };
      break;
    }

    case "product-poster": {
      // Clean modern campaign poster with NO BOX behind title
      const hBox: Box = { x: 80, y: 90, width: 920, height: 190 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline.toUpperCase(),
        box: hBox,
        font: fontH,
        size: fitFontSize(headline.toUpperCase(), fontH, hBox, 86),
        color: "#ffffff",
        align: "center",
      });

      if (subline) {
        const sBox: Box = { x: 100, y: 290, width: 880, height: 90 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline,
          box: sBox,
          font: fontB,
          size: fitFontSize(subline, fontB, sBox, 40),
          color: palette.accent || "#e4e4e7",
          align: "center",
        });
      }

      if (cta) {
        const cBox: Box = { x: 300, y: 1200, width: 480, height: 64 };
        textLayers.push({
          id: "cta",
          role: "cta",
          text: cta,
          box: cBox,
          font: "montserrat-bold",
          size: fitFontSize(cta, "montserrat-bold", cBox, 32),
          color: "#ffffff",
          align: "center",
        });
      }

      productBox = { x: 240, y: 400, width: 600, height: 780 };
      break;
    }

    case "big-type-behind": {
      // 1. Giant typography word behind product (BLU "BLU?" style)
      // E.g. "COLD", "PURE", "HYDRO" - spans broadly across the upper body
      // Whole word, never cut: long words get a smaller size instead.
      const keyword = (bigWord || headline.split(" ")[0] || "COLD").toUpperCase();
      const bgTextBox: Box = { x: 20, y: 190, width: 1040, height: 420 };
      const calcSize = fitFontSize(keyword, "bebas", bgTextBox, MAX_TEXT_SIZE);
      const bgWordColor = palette.accent.toLowerCase() === "#ffffff" ? "#ff007f" : palette.accent;
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

      if (subline || cta) {
        const text = (subline || cta)!.trim();
        const bBox: Box = { x: 100, y: 1200, width: 880, height: 80 };
        textLayers.push({
          id: "subline",
          role: "body",
          text,
          box: bBox,
          font: fontB,
          size: fitFontSize(text, fontB, bBox, 38),
          color: "#ffffff",
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
      const hBox: Box = { x: 90, y: 90, width: 900, height: 180 };
      textLayers.push({
        id: "headline",
        role: "headline",
        text: headline,
        box: hBox,
        font: fontH,
        size: fitFontSize(headline, fontH, hBox, 84),
        color: "#ffffff",
        align: "center",
      });

      if (subline) {
        const sBox: Box = { x: 100, y: 280, width: 880, height: 90 };
        textLayers.push({
          id: "subline",
          role: "body",
          text: subline,
          box: sBox,
          font: fontB,
          size: fitFontSize(subline, fontB, sBox, 40),
          color: palette.accent || "#e4e4e7",
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
          font: "montserrat-bold",
          size: fitFontSize(cta, "montserrat-bold", cBox, 36),
          color: "#ffffff",
          align: "center",
        });
      }

      productBox = { x: 250, y: 380, width: 580, height: 800 };
      break;
    }
  }

  // Override product box if caller specified custom dimensions
  if (input.productBox) {
    productBox = { ...productBox, ...input.productBox };
  }

  const background = templateBackground(templateId, palette, textLayers.some((t) => t.id === "cta"));
  return {
    sceneBrief,
    product: { box: productBox },
    text: textLayers,
    ...(background ? { background } : {}),
  };
}

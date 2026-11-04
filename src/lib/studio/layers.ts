// Slide layers (SRD v2.1 A-09). Pure types and helpers, safe to import from client components.
//
// A slide is a stack combined by code, bottom to top:
//   scene (Muse Image, no text, no product) -> text layers -> product shadow -> product (cutout pixels)
// The product is last, so text can never touch product pixels and the fidelity check (FR-FD-01) holds
// after every edit. Product pixels never pass through a generative model (FR-CG-09).

import { z } from "zod";

export const CANVAS_W = 1080;
export const CANVAS_H = 1350;

export type Box = { x: number; y: number; width: number; height: number };

/** Fonts bundled in src/lib/studio/fonts (OFL). The server has no system fonts, so only these render. */
export const FONTS = {
  "poppins-bold": { label: "Poppins Bold", file: "Poppins-Bold.ttf", family: "Poppins Bold" },
  poppins: { label: "Poppins", file: "Poppins-Regular.ttf", family: "Poppins" },
  bebas: { label: "Bebas Neue", file: "BebasNeue-Regular.ttf", family: "Bebas Neue" },
  "dm-serif": { label: "DM Serif Display", file: "DMSerifDisplay-Regular.ttf", family: "DM Serif Display" },
  "montserrat-bold": { label: "Montserrat Bold", file: "Montserrat-Bold.ttf", family: "Montserrat Bold" },
  montserrat: { label: "Montserrat", file: "Montserrat-Regular.ttf", family: "Montserrat" },
  "space-grotesk-bold": { label: "Space Grotesk Bold", file: "SpaceGrotesk-Bold.ttf", family: "Space Grotesk Bold" },
  "space-grotesk": { label: "Space Grotesk", file: "SpaceGrotesk-Regular.ttf", family: "Space Grotesk" },
  "science-gothic": { label: "Science Gothic", file: "ScienceGothic-Regular.ttf", family: "Science Gothic" },
  forum: { label: "Forum", file: "Forum-Regular.ttf", family: "Forum" },
  italiana: { label: "Italiana", file: "Italiana-Regular.ttf", family: "Italiana" },
  cambo: { label: "Cambo", file: "Cambo-Regular.ttf", family: "Cambo" },
  "cherry-cream-soda": { label: "Cherry Cream Soda", file: "CherryCreamSoda-Regular.ttf", family: "Cherry Cream Soda" },
  amethysta: { label: "Amethysta", file: "Amethysta-Regular.ttf", family: "Amethysta" },
} as const;
export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]];

/** Largest font size a text layer may store (the edit API rejects bigger ones). */
export const MAX_TEXT_SIZE = 260;

export type TextRole = "headline" | "body" | "cta";
export type TextLayer = {
  id: string;
  role: TextRole;
  text: string;
  box: Box;
  font: FontId;
  /** Font size in px on the 1080x1350 canvas. */
  size: number;
  /** #rrggbb */
  color: string;
  align: "left" | "center" | "right";
};

/** Poster layouts in src/lib/studio/templates.ts. */
export const TEMPLATE_IDS = [
  "product-highlight",
  "product-poster",
  "product-with-name",
  "big-type-behind",
  "color-block",
  "pedestal-hero",
  "tilted-hero",
  "offset-editorial",
  "tech-hero",
  "macro-detail",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** Template graphics (cards, banners) drawn between the scene and the text, so edits redraw them too. */
/** `cta: true` means the template draws its CTA pill (tech-hero, product-poster). */
export type SlideBackground = { template: TemplateId; dominant: string; accent: string; cta?: boolean };

/** Everything needed to rebuild a slide without a model call (except a new scene). */
export type SlideLayers = {
  /** The Muse Image brief the scene came from, reused by "New background". */
  sceneBrief: string;
  /** Where the product cutout sits. Aspect ratio is kept, so only the fit area is stored. */
  product: { box: Box };
  text: TextLayer[];
  /** Template graphics; absent on slides made without a template. */
  background?: SlideBackground;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function clampBox(b: Box, min = 40): Box {
  const width = clamp(b.width, min, CANVAS_W);
  const height = clamp(b.height, min, CANVAS_H);
  return { x: clamp(b.x, 0, CANVAS_W - width), y: clamp(b.y, 0, CANVAS_H - height), width, height };
}

const BoxSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
export const TextLayerSchema = z.object({
  id: z.string().min(1).max(40),
  role: z.enum(["headline", "body", "cta"]),
  text: z.string().max(200),
  box: BoxSchema,
  font: z.enum(FONT_IDS),
  size: z.number().min(16).max(MAX_TEXT_SIZE),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  align: z.enum(["left", "center", "right"]),
});
const HexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const SlideLayersSchema = z.object({
  sceneBrief: z.string().max(2000),
  product: z.object({ box: BoxSchema }),
  text: z.array(TextLayerSchema).max(6),
  background: z
    .object({ template: z.enum(TEMPLATE_IDS), dominant: HexSchema, accent: HexSchema, cta: z.boolean().optional() })
    .optional(),
});

/** Brand kit values the layers read (colours, fonts). All optional: a shop may have none. */
export type BrandStyle = { colors?: string[]; headingFont?: FontId | null; bodyFont?: FontId | null };

export const isFontId = (v: unknown): v is FontId => typeof v === "string" && v in FONTS;

/** Where text sits by default: the hook and product slides head the slide, the call to action closes it. */
export function defaultTextBox(role: "hook" | "product" | "cta" | undefined): Box {
  return role === "cta" ? { x: 80, y: 1060, width: 920, height: 200 } : { x: 80, y: 70, width: 920, height: 190 };
}

// Average glyph width per font, in em. Satori has no text measuring, so size is estimated, then stored on the layer.
const EM_WIDTH: Record<FontId, number> = {
  "poppins-bold": 0.62,
  poppins: 0.58,
  bebas: 0.42,
  "dm-serif": 0.52,
  "montserrat-bold": 0.64,
  montserrat: 0.58,
  "space-grotesk-bold": 0.63,
  "space-grotesk": 0.59,
  "science-gothic": 0.56,
  forum: 0.50,
  italiana: 0.48,
  cambo: 0.52,
  "cherry-cream-soda": 0.60,
  amethysta: 0.54,
};
const LINE_HEIGHT = 1.12;
export const textLineHeight = LINE_HEIGHT;

/** Largest size (px) at which `text` is expected to fit `box` when wrapped by words. */
export function fitFontSize(text: string, font: FontId, box: Box, max = 150): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return Math.min(max, 64);
  for (let size = Math.min(max, box.height); size > 20; size -= 2) {
    const perLine = Math.floor(box.width / (size * EM_WIDTH[font]));
    if (words.some((w) => w.length > perLine)) continue;
    let lines = 1;
    let used = 0;
    for (const w of words) {
      const need = used ? used + 1 + w.length : w.length;
      if (need > perLine) {
        lines += 1;
        used = w.length;
      } else used = need;
    }
    if (lines * size * LINE_HEIGHT <= box.height) return size;
  }
  return 20;
}

export function defaultTextLayer(opts: {
  role: "hook" | "product" | "cta" | undefined;
  text: string;
  color: string;
  brand?: BrandStyle;
}): TextLayer {
  const cta = opts.role === "cta";
  const font = (cta ? opts.brand?.bodyFont : opts.brand?.headingFont) ?? "poppins-bold";
  const box = defaultTextBox(opts.role);
  return {
    id: cta ? "cta" : "headline",
    role: cta ? "cta" : "headline",
    text: opts.text,
    box,
    font,
    size: fitFontSize(opts.text, font, box),
    color: opts.color,
    align: "center",
  };
}

export function normalizeLayers(layers: SlideLayers): SlideLayers {
  return {
    sceneBrief: layers.sceneBrief,
    product: { box: clampBox(layers.product.box, 120) },
    text: layers.text.map((t) => ({ ...t, box: clampBox(t.box) })),
    ...(layers.background ? { background: layers.background } : {}),
  };
}

/** Legacy slides (before A-09) carry no layers; callers treat them as read-only. */
export const asLayers = (value: unknown): SlideLayers | null => {
  const parsed = SlideLayersSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

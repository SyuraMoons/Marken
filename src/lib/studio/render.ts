// Layered slide renderer (SRD v2.1 A-09, FR-CG-09). Deterministic: same layers, same pixels.
// Text is drawn by code with bundled fonts (not by Muse Image), so owners can edit it exactly,
// spelling is whatever the owner or the plan wrote, and brand fonts and colours always apply.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { compositeProductSlide, type DropShadowOptions, type FramingMode, type PlacedProductBox } from "./composite";
import { buildTemplateBackgroundShapes } from "./templates";
import { CANVAS_H, CANVAS_W, FONTS, normalizeLayers, textLineHeight, type Box, type FontId, type SlideLayers, type TextLayer } from "./layers";

const FONT_DIR = path.join(process.cwd(), "src/lib/studio/fonts");

// The server has no system fonts and sharp ignores font files, so text is drawn by Satori (next/og) from the bundled files.
const fontData = new Map<FontId, Promise<Buffer>>();
const loadFont = (id: FontId) => {
  let data = fontData.get(id);
  if (!data) fontData.set(id, (data = readFile(path.join(FONT_DIR, FONTS[id].file))));
  return data;
};

/** One text layer as a transparent PNG the size of its box. */
async function renderText(layer: TextLayer): Promise<{ input: Buffer; left: number; top: number } | null> {
  const text = layer.text.trim();
  if (!text) return null;
  const hex = layer.color.toLowerCase();
  const isLight = hex === "#ffffff" || hex === "#fff" || hex.startsWith("#f") || hex.startsWith("#e");
  const textShadow = isLight
    ? "0 2px 14px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.92)"
    : "0 1px 10px rgba(255,255,255,0.7)";

  const res = new ImageResponse(
    createElement(
      "div",
      {
        style: {
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: layer.align === "center" ? "center" : layer.align === "right" ? "flex-end" : "flex-start",
          textAlign: layer.align,
          color: layer.color,
          fontFamily: layer.font,
          fontSize: layer.size,
          lineHeight: textLineHeight,
          textShadow,
        },
      },
      text,
    ),
    {
      width: layer.box.width,
      height: layer.box.height,
      fonts: [{ name: layer.font, data: await loadFont(layer.font), weight: 400, style: "normal" }],
    },
  );
  return { input: Buffer.from(await res.arrayBuffer()), left: layer.box.x, top: layer.box.y };
}

const luminance = (r: number, g: number, b: number) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** First brand colour that reads on the scene behind `box` (AA 4.5:1), otherwise white or near-black. */
export async function pickTextColor(scene: Buffer, box: Box, preferred: string[] = []): Promise<string> {
  const x = Math.max(0, Math.min(CANVAS_W - 1, box.x));
  const y = Math.max(0, Math.min(CANVAS_H - 1, box.y));
  const region = {
    left: x,
    top: y,
    width: Math.max(1, Math.min(box.width, CANVAS_W - x)),
    height: Math.max(1, Math.min(box.height, CANVAS_H - y)),
  };
  const { channels } = await sharp(scene).resize(CANVAS_W, CANVAS_H, { fit: "cover" }).extract(region).stats();
  const bg = luminance(channels[0].mean, channels[1].mean, channels[2].mean);
  const valid = preferred.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  for (const c of valid) if (contrast(bg, luminance(...hexRgb(c))) >= 4.5) return c.toLowerCase();
  return contrast(bg, 1) >= contrast(bg, 0.005) ? "#ffffff" : "#111111";
}

export type RenderLayeredInput = {
  scene: Buffer;
  /** Confirmed transparent product cutout. Its pixels are placed, never edited. */
  cutout: Buffer;
  layers: SlideLayers;
  shadow?: DropShadowOptions;
  framingMode?: FramingMode;
  /** Background graphics (cards, banners) under text and product. Defaults to the ones `layers.background` describes. */
  backgroundShapes?: Buffer | null;
};

export type RenderLayeredResult = {
  slideBuffer: Buffer;
  scaledCutoutBuffer: Buffer;
  placedBox: PlacedProductBox;
};

/** scene -> text -> shadow + product. Text goes under the product so fidelity (FR-FD-01) stays exact. */
export async function renderLayeredSlide(input: RenderLayeredInput): Promise<RenderLayeredResult> {
  const layers = normalizeLayers(input.layers);
  let base = await sharp(input.scene).resize(CANVAS_W, CANVAS_H, { fit: "cover" }).ensureAlpha().png().toBuffer();

  // Rebuilt from the stored layers, so a slide edit keeps the template card or banner.
  const shapes =
    input.backgroundShapes ??
    (layers.background ? buildTemplateBackgroundShapes(layers.background.template, layers.background) : null);
  if (shapes) {
    base = await sharp(base)
      .composite([{ input: shapes, left: 0, top: 0 }])
      .png()
      .toBuffer();
  }

  const texts = (await Promise.all(layers.text.map(renderText))).filter((t) => t !== null);
  const withText = texts.length ? await sharp(base).composite(texts).png().toBuffer() : base;

  const out = await compositeProductSlide({
    scene: withText,
    cutout: input.cutout,
    reservedBox: layers.product.box,
    framingMode: input.framingMode,
    // The stored box is the product's own fit area, so no extra breathing room is added on re-render.
    paddingRatio: 0,
    shadow: input.shadow,
  });
  return { slideBuffer: out.slideBuffer, scaledCutoutBuffer: out.scaledCutoutBuffer, placedBox: out.placedBox };
}

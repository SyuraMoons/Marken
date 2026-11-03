import { z } from "zod";
import { FONT_IDS, isFontId, type FontId } from "@/lib/studio/layers";

// Brand kit (SRD v2.1 A-09). Client-safe types and parsing; reads and writes live in data/ and actions/.
export type BrandKitValue = {
  colors: string[];
  heading_font: FontId | null;
  body_font: FontId | null;
  design_guidance: string;
  photo_style: string;
};

export const EMPTY_BRAND_KIT: BrandKitValue = { colors: [], heading_font: null, body_font: null, design_guidance: "", photo_style: "" };
export const MAX_COLORS = 5;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const BrandKitInput = z.object({
  colors: z.array(Hex).max(MAX_COLORS),
  heading_font: z.enum(FONT_IDS).nullable(),
  body_font: z.enum(FONT_IDS).nullable(),
  design_guidance: z.string().trim().max(1000),
  photo_style: z.string().trim().max(500),
});

/** What Muse Spark returns for "fill in from my description". */
export const BrandKitSuggestion = z.object({
  colors: z.array(Hex).min(2).max(MAX_COLORS),
  heading_font: z.enum(FONT_IDS),
  body_font: z.enum(FONT_IDS),
  design_guidance: z.string().trim().max(1000),
  photo_style: z.string().trim().max(500),
});

type Row = { colors: unknown; heading_font: string | null; body_font: string | null; design_guidance: string | null; photo_style: string | null } | null;

export function toBrandKit(row: Row): BrandKitValue {
  if (!row) return EMPTY_BRAND_KIT;
  return {
    colors: Array.isArray(row.colors) ? row.colors.filter((c): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, MAX_COLORS) : [],
    heading_font: isFontId(row.heading_font) ? row.heading_font : null,
    body_font: isFontId(row.body_font) ? row.body_font : null,
    design_guidance: row.design_guidance ?? "",
    photo_style: row.photo_style ?? "",
  };
}

export const MAX_BRIEF = 600;

/** Post goals offered as chips on the brief step. */
export const BRIEF_GOALS = ["launch", "bestseller", "event", "everyday"] as const;
export type BriefGoal = (typeof BRIEF_GOALS)[number];

/** A brief Marken drafts from the shop and product, so first-time owners never start from an empty box. */
export const DraftedBrief = z.object({
  goal: z.enum(BRIEF_GOALS).catch("everyday"),
  audience: z.string().trim().min(1).max(160),
  mood: z.string().trim().min(1).max(100),
  highlight: z.string().trim().min(1).max(200),
});
export type DraftedBrief = z.infer<typeof DraftedBrief>;

/** Three brand directions drafted from the owner's brief, shown as cards before a post is generated. */
export const BrandDirections = z.object({
  directions: z
    .array(BrandKitSuggestion.extend({ name: z.string().trim().min(1).max(40), summary: z.string().trim().max(200) }))
    .min(1)
    .max(3),
});
export type BrandDirection = z.infer<typeof BrandDirections>["directions"][number];

/** A saved kit counts as set up once it has any colour, font or guidance. */
export const hasBrandKit = (k: BrandKitValue) => k.colors.length > 0 || !!k.heading_font || !!k.body_font || !!k.design_guidance.trim() || !!k.photo_style.trim();

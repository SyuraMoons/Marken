// Shared Zod schemas for MARKEN AI agents (SRD v2.0 §7 & §9).

import { z } from "zod";

/**
 * Raw schema returned by `Muse Spark` during `extract_products` (`FR-SP-01`, `FR-SP-02`).
 * Includes `price_visible_in_photo` so code can deterministically enforce `price: null`
 * whenever no price is literally printed in the photo.
 */
export const RawProductExtractionModelSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price_visible_in_photo: z.boolean().default(false),
  price: z.number().positive().nullable().default(null),
  currency: z.string().min(1).max(10).nullable().default(null),
  attributes: z.array(z.string()).default([]),
  description: z.string().min(1),
});

/**
 * Final validated product metadata contract (`FR-SP-01`, `FR-SP-02`).
 */
export const ExtractedProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().positive().nullable(),
  currency: z.string().nullable(),
  attributes: z.array(z.string()),
  description: z.string().min(1),
  source_photo: z.string().min(1),
});

export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;


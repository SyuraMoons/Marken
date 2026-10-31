// Product Extraction & Cutout Pipeline (SRD v2.0 §7.2 — FR-SP-01, FR-SP-02, FR-SP-09).
// Extracts structured product metadata with `Muse Spark` (`muse-spark-1.3`) and cuts out
// each product into a transparent PNG with `SAM 3.1` in parallel (< 30s for 3-10 photos).

import sharp from "sharp";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import {
  cutoutProduct,
  type CutoutProductResult,
  type NormalizedBBox,
} from "../studio/cutout";
import {
  ExtractedProductSchema,
  RawProductExtractionModelSchema,
  type ExtractedProduct,
} from "./schemas";

export type PhotoInputItem = {
  /**
   * Raw image bytes (`Buffer` / `Uint8Array`), base64, data URL, or signed URL.
   */
  photo: Buffer | Uint8Array | string;
  /**
   * Identifier or storage path of the uploaded source photo (e.g., `uploads/shop_1/photo_1.jpg`).
   */
  sourcePhotoId: string;
  /**
   * Optional segmentation hint for `SAM 3.1`.
   */
  labelHint?: string;
};

export type ExtractProductFromPhotoInput = PhotoInputItem & {
  shopId?: string;
  postId?: string;
  contentLanguage?: "en" | "id";
};

export type ExtractProductFromPhotoResult = {
  product: ExtractedProduct;
  telemetry: ModelCallTelemetry;
};

export type ExtractedProductWithCutout = {
  product: ExtractedProduct;
  cutout: {
    cutoutBuffer: Buffer;
    cutoutDataUrl: string;
    bbox: NormalizedBBox;
    width: number;
    height: number;
    confidence: number;
  };
  telemetry: {
    extract: ModelCallTelemetry;
    cutout: ModelCallTelemetry;
  };
};

export type ExtractProductsAndCutoutsInput = {
  photos: PhotoInputItem[];
  shopId?: string;
  postId?: string;
  contentLanguage?: "en" | "id";
};

export type ExtractProductsAndCutoutsResult = {
  items: ExtractedProductWithCutout[];
  totalLatencyMs: number;
  totalCostUsd: number;
};

async function photoToDataUrl(
  photo: Buffer | Uint8Array | string,
): Promise<string> {
  if (Buffer.isBuffer(photo)) {
    const jpegBuf = await sharp(photo)
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpegBuf.toString("base64")}`;
  }
  if (photo instanceof Uint8Array) {
    const jpegBuf = await sharp(Buffer.from(photo))
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpegBuf.toString("base64")}`;
  }
  const trimmed = photo.trim();
  if (trimmed.startsWith("data:image/") || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `data:image/jpeg;base64,${trimmed}`;
}

const EXTRACT_SYSTEM_PROMPT = `You are MARKEN's Product Catalog Extraction Agent (SRD v2.0 FR-SP-01 & FR-SP-02).
Examine the uploaded product photo and return strictly valid JSON matching this structure:
{
  "name": "concise commercial product name (2-6 words)",
  "category": "product category (e.g. Bottle & Drinkware, Skincare & Essential Oils, Apparel, Food & Beverage, Accessories, Home Decor)",
  "price_visible_in_photo": boolean,
  "price": number | null,
  "currency": "IDR" | "USD" | string | null,
  "attributes": ["material/color/finish/feature 1", "feature 2", "feature 3"],
  "description": "1-2 sentence factual description of the visible physical product"
}

STRICT TRUTH GUARDRAIL (FR-SP-02):
- Set "price_visible_in_photo" to true ONLY if a price tag, menu price, or printed price number is literally visible inside the image.
- When no price is visible in the photo, you MUST set "price_visible_in_photo": false, "price": null, and "currency": null.
- NEVER guess, estimate, or invent a price or unverified product claim.`;

/**
 * Extracts structured product metadata from a single product photo using `Muse Spark` (`FR-SP-01`, `FR-SP-02`).
 * Deterministically forces `price: null` and `currency: null` whenever `price_visible_in_photo` is false.
 */
export async function extractProductFromPhoto(
  input: ExtractProductFromPhotoInput,
): Promise<ExtractProductFromPhotoResult> {
  const imageUrl = await photoToDataUrl(input.photo);
  const langInstruction =
    input.contentLanguage === "id"
      ? "Write name, attributes, and description in Bahasa Indonesia."
      : "Write name, attributes, and description in English.";

  const { data: raw, telemetry } = await callModelWithTelemetry({
    step: "extract_products",
    model: "muse-spark",
    shopId: input.shopId,
    postId: input.postId,
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    input: {
      imageUrl,
      prompt: `Extract the product details from this photo (source_photo: "${input.sourcePhotoId}"). ${langInstruction} Remember: if no price number is printed in the photo, set price_visible_in_photo=false and price=null.`,
    },
    schema: RawProductExtractionModelSchema,
  });

  // Deterministic Truth Guardrail (FR-SP-02): never allow a price unless explicitly visible
  const safePrice = raw.price_visible_in_photo ? raw.price : null;
  const safeCurrency =
    raw.price_visible_in_photo && safePrice !== null ? raw.currency : null;

  const product = ExtractedProductSchema.parse({
    name: raw.name.trim(),
    category: raw.category.trim(),
    price: safePrice,
    currency: safeCurrency,
    attributes: raw.attributes.map((a) => a.trim()).filter(Boolean),
    description: raw.description.trim(),
    source_photo: input.sourcePhotoId,
  });

  return { product, telemetry };
}

/**
 * Batch pipeline (`FR-SP-01`, `FR-SP-02`, `FR-SP-09`) consumed by `POST /api/shops/:id/extract`.
 * Runs `Muse Spark` metadata extraction and `SAM 3.1` product cutout in parallel across all
 * uploaded photos (3-10 photos under 30 seconds).
 */
export async function extractProductsAndCutouts(
  input: ExtractProductsAndCutoutsInput,
): Promise<ExtractProductsAndCutoutsResult> {
  const startedAt = performance.now();

  const items = await Promise.all(
    input.photos.map(async (item): Promise<ExtractedProductWithCutout> => {
      // Run Muse Spark vision extraction and SAM 3.1 cutout concurrently per photo
      const [extractRes, cutoutRes]: [
        ExtractProductFromPhotoResult,
        CutoutProductResult,
      ] = await Promise.all([
        extractProductFromPhoto({
          ...item,
          shopId: input.shopId,
          postId: input.postId,
          contentLanguage: input.contentLanguage,
        }),
        cutoutProduct({
          photo: item.photo,
          labelHint: item.labelHint ?? "main product",
          shopId: input.shopId,
          postId: input.postId,
        }),
      ]);

      return {
        product: extractRes.product,
        cutout: {
          cutoutBuffer: cutoutRes.cutoutBuffer,
          cutoutDataUrl: cutoutRes.cutoutDataUrl,
          bbox: cutoutRes.bbox,
          width: cutoutRes.width,
          height: cutoutRes.height,
          confidence: cutoutRes.confidence,
        },
        telemetry: {
          extract: extractRes.telemetry,
          cutout: cutoutRes.telemetry,
        },
      };
    }),
  );

  const totalLatencyMs = Math.max(1, Math.round(performance.now() - startedAt));
  const totalCostUsd = Number(
    items
      .reduce(
        (sum, item) =>
          sum + item.telemetry.extract.costUsd + item.telemetry.cutout.costUsd,
        0,
      )
      .toFixed(6),
  );

  return {
    items,
    totalLatencyMs,
    totalCostUsd,
  };
}


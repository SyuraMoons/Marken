// Product Extraction & Cutout Pipeline (SRD v2.0 §7.2 — FR-SP-01, FR-SP-02, FR-SP-09).
// Extracts structured product metadata with `Muse Spark` (`muse-spark-1.3`) and cuts out
// each product into a transparent PNG with `SAM 3.1` in parallel (< 30s for 3-10 photos).

import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import {
  CutoutFailedError,
  cutoutProduct,
  type NormalizedBBox,
} from "../studio/cutout";
import {
  normalizePhoto,
  photoToModelDataUrl,
  type PhotoInput,
  type PhotoSource,
} from "../studio/photo";
import {
  ExtractedProductSchema,
  RawProductExtractionModelSchema,
  type ExtractedProduct,
} from "./schemas";

// Each photo makes two model calls, so this allows at most 10 in flight
const MAX_CONCURRENT_PHOTOS = 5;

const EXTRACT_INPUT_MAX_SIDE = 1024;

export type PhotoInputItem = {
  /**
   * Raw image bytes (`Buffer` / `Uint8Array`), base64, data URL, or signed URL.
   */
  photo: PhotoSource;
  /**
   * Identifier or storage path of the uploaded source photo (e.g., `uploads/shop_1/photo_1.jpg`).
   */
  sourcePhotoId: string;
  /**
   * Optional segmentation hint for `SAM 3.1`.
   */
  labelHint?: string;
};

export type ExtractProductFromPhotoInput = Omit<PhotoInputItem, "photo"> & {
  photo: PhotoInput;
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
    confidence: number | null;
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

export type PhotoExtractionFailure = {
  sourcePhotoId: string;
  error: string;
  /** Model calls this photo still made, which count towards the batch cost. */
  telemetry: ModelCallTelemetry[];
};

export type ExtractProductsAndCutoutsResult = {
  items: ExtractedProductWithCutout[];
  /** Photos the owner needs to retry. The rest of the batch is unaffected. */
  failures: PhotoExtractionFailure[];
  totalLatencyMs: number;
  totalCostUsd: number;
};

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
  const imageUrl = await photoToModelDataUrl(
    await normalizePhoto(input.photo),
    EXTRACT_INPUT_MAX_SIDE,
  );
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

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

async function processPhoto(
  item: PhotoInputItem,
  input: ExtractProductsAndCutoutsInput,
): Promise<ExtractedProductWithCutout | PhotoExtractionFailure> {
  const { sourcePhotoId } = item;

  let photo: PhotoInput;
  try {
    photo = await normalizePhoto(item.photo);
  } catch (reason) {
    return { sourcePhotoId, error: errorMessage(reason), telemetry: [] };
  }

  // Run Muse Spark vision extraction and SAM 3.1 cutout concurrently per photo
  const [extractRes, cutoutRes] = await Promise.allSettled([
    extractProductFromPhoto({
      ...item,
      photo,
      shopId: input.shopId,
      postId: input.postId,
      contentLanguage: input.contentLanguage,
    }),
    cutoutProduct({
      photo,
      labelHint: item.labelHint ?? "main product",
      shopId: input.shopId,
      postId: input.postId,
    }),
  ]);

  if (extractRes.status === "fulfilled" && cutoutRes.status === "fulfilled") {
    const { telemetry: cutoutTelemetry, ...cutout } = cutoutRes.value;
    return {
      product: extractRes.value.product,
      cutout,
      telemetry: {
        extract: extractRes.value.telemetry,
        cutout: cutoutTelemetry,
      },
    };
  }

  const telemetry: ModelCallTelemetry[] = [];
  const errors: string[] = [];
  if (extractRes.status === "fulfilled") {
    telemetry.push(extractRes.value.telemetry);
  } else {
    errors.push(errorMessage(extractRes.reason));
  }
  if (cutoutRes.status === "fulfilled") {
    telemetry.push(cutoutRes.value.telemetry);
  } else {
    errors.push(errorMessage(cutoutRes.reason));
    if (cutoutRes.reason instanceof CutoutFailedError) {
      telemetry.push(cutoutRes.reason.telemetry);
    }
  }

  return { sourcePhotoId, error: errors.join("; "), telemetry };
}

/**
 * Maps with a concurrency cap, keeping input order.
 */
async function mapWithLimit<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const worker = async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

/**
 * Batch pipeline (`FR-SP-01`, `FR-SP-02`, `FR-SP-09`) consumed by `POST /api/shops/:id/extract`.
 * Runs `Muse Spark` metadata extraction and `SAM 3.1` product cutout in parallel across the
 * uploaded photos (3-10 photos under 30 seconds). A photo that fails lands in `failures`
 * and never costs the owner the rest of the batch.
 */
export async function extractProductsAndCutouts(
  input: ExtractProductsAndCutoutsInput,
): Promise<ExtractProductsAndCutoutsResult> {
  const startedAt = performance.now();

  const results = await mapWithLimit(
    input.photos,
    MAX_CONCURRENT_PHOTOS,
    (item) => processPhoto(item, input),
  );

  const items: ExtractedProductWithCutout[] = [];
  const failures: PhotoExtractionFailure[] = [];
  for (const result of results) {
    if ("error" in result) failures.push(result);
    else items.push(result);
  }

  const totalLatencyMs = Math.max(1, Math.round(performance.now() - startedAt));
  const totalCostUsd = Number(
    [
      ...items.flatMap((item) => [
        item.telemetry.extract,
        item.telemetry.cutout,
      ]),
      ...failures.flatMap((failure) => failure.telemetry),
    ]
      .reduce((sum, telemetry) => sum + telemetry.costUsd, 0)
      .toFixed(6),
  );

  return {
    items,
    failures,
    totalLatencyMs,
    totalCostUsd,
  };
}

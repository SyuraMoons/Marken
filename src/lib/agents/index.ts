// MARKEN AI Agent exports (SRD v2.0 §4 & §7).

export {
  extractProductFromPhoto,
  extractProductsAndCutouts,
  type ExtractProductFromPhotoInput,
  type ExtractProductFromPhotoResult,
  type ExtractProductsAndCutoutsInput,
  type ExtractProductsAndCutoutsResult,
  type ExtractedProductWithCutout,
  type PhotoExtractionFailure,
  type PhotoInputItem,
} from "./extract";
export {
  ExtractedProductSchema,
  RawProductExtractionModelSchema,
  type ExtractedProduct,
} from "./schemas";


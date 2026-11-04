// The ONLY path to any model (FR-CL-01). Routes a step to a model, validates JSON
// output, logs a model_calls row with cost, falls back to Llama for text (NFR-18).
// Provider clients will live in ./providers and must not be imported elsewhere.

export type ModelId = "muse-spark" | "muse-image" | "sam-3.1" | "llama";

export type Step =
  | "extract_products"
  | "analyse_trend"
  | "score_trend"
  | "plan_post"
  | "check_rules"
  | "cutout"
  | "render_image"
  | "regenerate_caption"
  | "regenerate_image"
  | "weekly_learning";

export type ModelCall<TInput> = {
  step: Step;
  model: ModelId;
  shopId?: string;
  postId?: string;
  input: TInput;
};

export async function callModel<TInput, TOutput>(
  call: ModelCall<TInput>,
): Promise<TOutput> {
  throw new Error(`callModel not implemented (step: ${call.step})`);
}

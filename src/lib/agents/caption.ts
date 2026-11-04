// Caption Regeneration by Feedback (SRD v2.0 §7.5 — FR-ED-01, FR-ED-02, F-11).
// Rewrites or refines post captions from owner feedback in under 10s, enforces
// max 5 revisions per post per day, and validates output against shop style rules.

import { z } from "zod";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import { checkStyleRules } from "./rules";
import { RegenerateCaptionModelSchema } from "./schemas";

export const MAX_REVISIONS_PER_DAY = 5;

export type RegenerateCaptionInput = {
  currentCaption: string | null;
  feedback: string;
  shop?: {
    id?: string;
    tone?: string | null;
    contentLanguage?: "en" | "id";
    styleRules?: string[];
  };
  product?: {
    name?: string | null;
    price?: number | null;
  };
  revisionCountToday?: number;
  postId?: string;
};

export type RegeneratedCaptionOption = {
  label: string;
  text: string;
};

export type RegenerateCaptionResult = {
  options: RegeneratedCaptionOption[];
  chosenCaption: string;
  revisionCount: number;
  remainingRevisionsToday: number;
  rulesPassed: boolean;
  ruleViolations: string[];
  telemetry: ModelCallTelemetry[];
};

export class RevisionLimitExceededError extends Error {
  constructor(message = "Daily caption revision limit reached (max 5 per post per day).") {
    super(message);
    this.name = "RevisionLimitExceededError";
  }
}

/**
 * `T-7.1` — Regenerate caption options from owner feedback (`FR-ED-01`).
 */
export async function regenerateCaptionFromFeedback(
  input: RegenerateCaptionInput,
): Promise<RegenerateCaptionResult> {
  const currentCount = input.revisionCountToday ?? 0;
  if (currentCount >= MAX_REVISIONS_PER_DAY) {
    throw new RevisionLimitExceededError();
  }

  const shop = input.shop ?? {};
  const contentLanguage = shop.contentLanguage ?? "en";
  const styleRules = (shop.styleRules ?? []).slice(0, 10);
  const forbidPrices =
    input.product?.price === null ||
    input.product?.price === undefined ||
    styleRules.some((r) =>
      /(never|no|don't|do not|without|jangan|tanpa)\b.*\b(price|prices|pricing|cost|harga)/i.test(
        r,
      ),
    );

  const systemPrompt = [
    "You are MARKEN's Caption Revision Agent (FR-ED-01).",
    "Rewrite and refine the Instagram caption based strictly on the owner's feedback.",
    `Content Language: ${contentLanguage === "id" ? "Bahasa Indonesia" : "English"}.`,
    `Shop Tone: ${shop.tone ?? "warm, authentic, engaging"}.`,
    styleRules.length > 0
      ? `Strict Shop Style Rules:\n${styleRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
      : "",
    forbidPrices
      ? "CRITICAL TRUTH GUARDRAIL (FR-SP-02): NEVER invent or mention any price, cost, discount figure, or currency."
      : "",
    "Respond strictly with valid JSON: { \"caption\": string, \"options\": [string, string] }.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = JSON.stringify({
    currentCaption: input.currentCaption ?? "",
    feedback: input.feedback.trim(),
    productName: input.product?.name ?? "the product",
  });

  const { data, telemetry } = await callModelWithTelemetry<
    string,
    z.infer<typeof RegenerateCaptionModelSchema>
  >({
    step: "regenerate_caption",
    model: "muse-spark",
    shopId: shop.id,
    postId: input.postId,
    systemPrompt,
    schema: RegenerateCaptionModelSchema,
    input: userPrompt,
  });

  const telemetryList: ModelCallTelemetry[] = [telemetry];

  // Build 2 options (primary + alternative or derived)
  const textOptions = data.options && data.options.length > 0
    ? data.options
    : [data.caption];

  if (textOptions.length === 1) {
    // Generate an alternate tone or shorter variation if only 1 returned
    textOptions.push(data.caption);
  }

  const options: RegeneratedCaptionOption[] = textOptions.slice(0, 2).map((txt, idx) => ({
    label: idx === 0 ? "A" : "B",
    text: txt.trim(),
  }));

  // Style rule verification (FR-SP-06)
  const ruleCheck = await checkStyleRules({
    texts: options.map((o) => o.text),
    shopTone: shop.tone ?? undefined,
    styleRules,
    contentLanguage,
    forbidPrices,
    shopId: shop.id,
    postId: input.postId,
  });
  telemetryList.push(ruleCheck.telemetry);

  const nextRevisionCount = currentCount + 1;
  const remaining = Math.max(0, MAX_REVISIONS_PER_DAY - nextRevisionCount);

  return {
    options,
    chosenCaption: options[0].text,
    revisionCount: nextRevisionCount,
    remainingRevisionsToday: remaining,
    rulesPassed: ruleCheck.passed,
    ruleViolations: ruleCheck.violations,
    telemetry: telemetryList,
  };
}

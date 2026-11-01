// Shop Style Rule & Truth Guardrail Checker (SRD v2.0 §7.2 — FR-SP-02, FR-SP-04..06, F-05).
// Evaluates captions and slide copy against shop tone, up to 10 style rules,
// and the hard truth guardrail that unpriced products (price: null) must never have prices invented.

import { z } from "zod";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import { StyleRuleCheckModelSchema } from "./schemas";

export type CheckStyleRulesInput = {
  /** Array of copy texts to check (slide headlines, captions, CTA copy) */
  texts: string[];
  /** Shop tone description (e.g. "warm, conversational, artisanal") */
  shopTone?: string;
  /** Up to 10 shop style rules (e.g. ["Never show prices", "No ALL CAPS"]) */
  styleRules?: string[];
  /** Content language ("en" | "id") */
  contentLanguage?: "en" | "id";
  /** If true or price is null, strictly forbids any price or currency in all texts (FR-SP-02) */
  forbidPrices?: boolean;
  shopId?: string;
  postId?: string;
};

export type CheckStyleRulesResult = {
  passed: boolean;
  violations: string[];
  checkedTextCount: number;
  telemetry: ModelCallTelemetry;
};

/**
 * Deterministic regex pass to catch obvious price & ALL CAPS violations before/with model check.
 */
export function evaluateLocalRuleViolations(params: {
  texts: string[];
  styleRules: string[];
  forbidPrices?: boolean;
}): string[] {
  const violations: string[] = [];
  const rules = (params.styleRules ?? []).slice(0, 10);

  const priceRuleActive =
    params.forbidPrices ||
    rules.some((r) =>
      /(never|no|don't|do not|without|jangan|tanpa)\b.*\b(price|prices|pricing|cost|harga|diskon)/i.test(
        r,
      ),
    );

  const allCapsRuleActive = rules.some((r) =>
    /(never|no|don't|do not|avoid)\b.*\b(all caps|all-caps|uppercase)/i.test(r),
  );

  const pricePattern =
    /(\$|€|£|¥|\bRp\.?\s?\d|\bIDR\s?\d|\bUSD\s?\d|\d+[.,]\d{3}\b|\b\d+\s?(rb|ribu|k)\b)/i;

  // Custom forbidden keywords: e.g. "Do not use word X", "Never say Y", "Forbidden word Z"
  const forbiddenWordRules: RegExp[] = [];
  for (const r of rules) {
    const match = r.match(/(?:never use|do not use|don't use|avoid word|forbidden word|no)\s+["']?([a-zA-Z0-9_\s-]+)["']?/i);
    if (match && match[1]) {
      const phrase = match[1].trim();
      if (phrase && !/price|all caps|uppercase/i.test(phrase)) {
        forbiddenWordRules.push(new RegExp(`\\b${phrase}\\b`, "i"));
      }
    }
  }

  for (const text of params.texts) {
    const trimmed = text.trim();
    if (!trimmed) continue;

    if (priceRuleActive && pricePattern.test(trimmed)) {
      violations.push(
        `Price detected in text: "${trimmed}". Shop has a strict rule or truth guardrail against showing prices.`,
      );
    }

    if (allCapsRuleActive) {
      const words = trimmed.split(/\s+/).filter((w) => /^[A-Z]{4,}$/.test(w));
      if (words.length >= 2) {
        violations.push(
          `ALL CAPS detected in text: "${trimmed}". Violates shop style rule against uppercase shouting.`,
        );
      }
    }

    for (const re of forbiddenWordRules) {
      if (re.test(trimmed)) {
        violations.push(
          `Forbidden word matched in text: "${trimmed}". Violates rule: ${re.source}`,
        );
      }
    }
  }

  return violations;
}

/**
 * Checks slide texts & captions against shop tone and style rules (`FR-SP-04..06`).
 */
export async function checkStyleRules(
  input: CheckStyleRulesInput,
): Promise<CheckStyleRulesResult> {
  const cleanTexts = input.texts.map((t) => t.trim()).filter(Boolean);
  const rules = (input.styleRules ?? []).slice(0, 10);

  if (cleanTexts.length === 0) {
    return {
      passed: true,
      violations: [],
      checkedTextCount: 0,
      telemetry: {
        id: "empty_check",
        shopId: input.shopId ?? null,
        postId: input.postId ?? null,
        step: "check_rules",
        model: "muse-spark",
        requestedModel: "muse-spark",
        tokensIn: 0,
        tokensOut: 0,
        images: 0,
        latencyMs: 1,
        costUsd: 0,
        cacheHit: false,
        fallback: false,
        retries: 0,
        provider: "mock",
        createdAt: new Date().toISOString(),
      },
    };
  }

  // 1. Fast deterministic check
  const localViolations = evaluateLocalRuleViolations({
    texts: cleanTexts,
    styleRules: rules,
    forbidPrices: input.forbidPrices,
  });

  // 2. Semantic model check via Muse Spark (step: "check_rules", temperature: 0.1)
  const systemPrompt = [
    "You are MARKEN's Shop Style Rule & Truth Guardrail Checker (FR-SP-04..06).",
    "Inspect the provided marketing texts (carousel slide copy, captions, CTA) against the shop's tone and style rules.",
    "Rules to enforce:",
    "- All supplied shop style rules (up to 10).",
    "- Shop tone consistency.",
    "- Truth guardrail: If `forbidPrices` is true or any rule forbids prices, NO prices, discounts, or currency figures may appear.",
    'Respond strictly with valid JSON: { "passed": boolean, "violations": string[], "checkedTextCount": number }.',
  ].join("\n");

  const { data, telemetry } = await callModelWithTelemetry<
    string,
    z.infer<typeof StyleRuleCheckModelSchema>
  >({
    step: "check_rules",
    model: "muse-spark",
    shopId: input.shopId,
    postId: input.postId,
    systemPrompt,
    schema: StyleRuleCheckModelSchema,
    input: JSON.stringify({
      texts: cleanTexts,
      shopTone: input.shopTone ?? "warm, authentic, commercial lifestyle",
      styleRules: rules,
      forbidPrices: Boolean(input.forbidPrices),
      contentLanguage: input.contentLanguage ?? "en",
    }),
  });

  const allViolations = Array.from(
    new Set([...localViolations, ...data.violations]),
  );
  const passed = data.passed && localViolations.length === 0 && allViolations.length === 0;

  return {
    passed,
    violations: allViolations,
    checkedTextCount: cleanTexts.length,
    telemetry,
  };
}

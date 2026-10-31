import type { ProviderRawResponse, ProviderRequest } from "../types";
import { LIVE_META_MODEL_IDS, ProviderError, sanitizeBaseUrl } from "./meta";

function resolveSparkOpenConfig(): {
  apiKey: string | undefined;
  baseUrl: string | undefined;
  modelId: string;
} {
  const dedicatedKey =
    process.env.MUSE_SPARK_OPEN_API_KEY?.trim() ||
    process.env.LLAMA_API_KEY?.trim();
  const dedicatedUrl = sanitizeBaseUrl(
    process.env.MUSE_SPARK_OPEN_BASE_URL || process.env.LLAMA_API_BASE_URL,
  );

  if (dedicatedKey && dedicatedUrl) {
    return {
      apiKey: dedicatedKey,
      baseUrl: dedicatedUrl,
      modelId: "muse-spark-open",
    };
  }

  // Default to Meta Model API `muse-spark-1.3-contributor` ($150 free credit pool)
  return {
    apiKey: process.env.META_MODEL_API_KEY?.trim(),
    baseUrl: sanitizeBaseUrl(process.env.META_MODEL_API_BASE_URL),
    modelId: LIVE_META_MODEL_IDS["muse-spark-open"],
  };
}

export function isSparkOpenConfigured(): boolean {
  const { apiKey, baseUrl } = resolveSparkOpenConfig();
  return Boolean(apiKey && baseUrl && process.env.GATEWAY_MODE !== "mock");
}

/**
 * Calls `Muse Spark Open` (`muse-spark-1.3-contributor` on Meta API or Baseten/Modal override).
 * Used directly for `score_trend` (`FR-TR-05`) and as the text fallback when
 * the primary model fails (`NFR-18`).
 * Never import this outside `src/lib/gateway/`.
 */
export async function callSparkOpenProvider(
  req: ProviderRequest,
): Promise<ProviderRawResponse> {
  const { apiKey, baseUrl, modelId } = resolveSparkOpenConfig();

  if (!apiKey || !baseUrl) {
    throw new ProviderError(
      "Neither META_MODEL_API_KEY nor MUSE_SPARK_OPEN_API_KEY is configured",
      { provider: "spark-open", retriable: false },
    );
  }

  const baseSystem =
    req.systemPrompt ??
    (req.expectJson
      ? "You are Muse Spark Open running inside MARKEN. Respond strictly with valid JSON matching the requested schema. Do not include markdown fences."
      : "You are Muse Spark Open running inside MARKEN.");

  const systemContent = req.retryValidationError
    ? `${baseSystem}\n\nIMPORTANT RETRY NOTICE: Your previous response failed schema validation:\n${req.retryValidationError}\nReturn valid JSON only.`
    : baseSystem;

  const userContent =
    typeof req.input === "string" ? req.input : JSON.stringify(req.input);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      ...(req.expectJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new ProviderError(
      `Muse Spark Open (${modelId}) failed with HTTP ${response.status}: ${errText}`,
      { provider: "spark-open", statusCode: response.status, retriable: false },
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    rawOutput: payload.choices?.[0]?.message?.content ?? "",
    tokensIn: payload.usage?.prompt_tokens ?? 280,
    tokensOut: payload.usage?.completion_tokens ?? 120,
    images: 0,
    provider: "spark-open",
  };
}



import type { ProviderRawResponse, ProviderRequest } from "../types";
import { ProviderError } from "./meta";

function resolveSparkOpenConfig(): {
  apiKey: string | undefined;
  baseUrl: string | undefined;
} {
  const apiKey =
    process.env.MUSE_SPARK_OPEN_API_KEY?.trim() ||
    process.env.LLAMA_API_KEY?.trim();
  const baseUrl = (
    process.env.MUSE_SPARK_OPEN_BASE_URL?.trim() ||
    process.env.LLAMA_API_BASE_URL?.trim()
  )?.replace(/\/+$/, "");

  return { apiKey, baseUrl };
}

export function isSparkOpenConfigured(): boolean {
  const { apiKey, baseUrl } = resolveSparkOpenConfig();
  return Boolean(apiKey && baseUrl && process.env.GATEWAY_MODE !== "mock");
}

/**
 * Calls `Muse Spark Open` hosted on Baseten or Modal.
 * Used directly for `score_trend` (`FR-TR-05`) and as the text fallback when
 * the Meta Model API fails (`NFR-18`).
 * Never import this outside `src/lib/gateway/`.
 */
export async function callSparkOpenProvider(
  req: ProviderRequest,
): Promise<ProviderRawResponse> {
  const { apiKey, baseUrl } = resolveSparkOpenConfig();

  if (!apiKey || !baseUrl) {
    throw new ProviderError(
      "MUSE_SPARK_OPEN_API_KEY/LLAMA_API_KEY or BASE_URL is not configured",
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
      model: "muse-spark-open",
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
      `Muse Spark Open failed with HTTP ${response.status}: ${errText}`,
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


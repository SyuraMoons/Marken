import type { ProviderRawResponse, ProviderRequest } from "../types";

export class ProviderError extends Error {
  readonly provider: "meta" | "spark-open";
  readonly statusCode?: number;
  readonly retriable: boolean;

  constructor(
    message: string,
    options: {
      provider: "meta" | "spark-open";
      statusCode?: number;
      retriable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.retriable = options.retriable ?? true;
  }
}

export function isMetaConfigured(): boolean {
  return Boolean(
    process.env.META_MODEL_API_KEY?.trim() &&
      process.env.META_MODEL_API_BASE_URL?.trim() &&
      process.env.GATEWAY_MODE !== "mock",
  );
}

function buildMessages(req: ProviderRequest): Array<{
  role: "system" | "user";
  content: unknown;
}> {
  const messages: Array<{ role: "system" | "user"; content: unknown }> = [];
  const baseSystem =
    req.systemPrompt ??
    (req.expectJson
      ? "You are a core AI agent inside MARKEN. Respond strictly with valid JSON matching the requested schema. Do not wrap in markdown code fences."
      : "You are a core AI agent inside MARKEN.");

  const systemContent = req.retryValidationError
    ? `${baseSystem}\n\nIMPORTANT RETRY NOTICE: Your previous response failed schema validation with error:\n${req.retryValidationError}\nReturn corrected valid JSON only.`
    : baseSystem;

  messages.push({ role: "system", content: systemContent });

  if (typeof req.input === "string") {
    messages.push({ role: "user", content: req.input });
  } else {
    messages.push({
      role: "user",
      content: JSON.stringify(req.input),
    });
  }

  return messages;
}

/**
 * Calls the Meta Model API (`muse-spark`, `muse-wonder`, `muse-image`, `sam-3.1`).
 * Never import this outside `src/lib/gateway/`.
 */
export async function callMetaProvider(
  req: ProviderRequest,
): Promise<ProviderRawResponse> {
  const apiKey = process.env.META_MODEL_API_KEY?.trim();
  const baseUrl = process.env.META_MODEL_API_BASE_URL?.trim()?.replace(
    /\/+$/,
    "",
  );

  if (!apiKey || !baseUrl) {
    throw new ProviderError(
      "META_MODEL_API_KEY or META_MODEL_API_BASE_URL is not configured",
      { provider: "meta", retriable: true },
    );
  }

  // Image generation (Muse Image — 1080x1350 scene with reserved empty product area)
  if (req.model === "muse-image") {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "muse-image",
        size: "1080x1350",
        response_format: "b64_json",
        ...(typeof req.input === "object" && req.input !== null
          ? req.input
          : { prompt: String(req.input) }),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ProviderError(
        `Meta Model API (muse-image) failed with HTTP ${response.status}: ${errText}`,
        { provider: "meta", statusCode: response.status },
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const first = payload.data?.[0];

    return {
      rawOutput: {
        imageBase64: first?.b64_json ?? null,
        imageUrl: first?.url ?? null,
        width: 1080,
        height: 1350,
      },
      tokensIn: 0,
      tokensOut: 0,
      images: 1,
      provider: "meta",
    };
  }

  // Product cutout segmentation (SAM 3.1)
  if (req.model === "sam-3.1") {
    const response = await fetch(`${baseUrl}/images/segment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sam-3.1",
        output_format: "png",
        ...(typeof req.input === "object" && req.input !== null
          ? req.input
          : { image: String(req.input) }),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ProviderError(
        `Meta Model API (sam-3.1) failed with HTTP ${response.status}: ${errText}`,
        { provider: "meta", statusCode: response.status },
      );
    }

    const payload = (await response.json()) as {
      cutout_b64?: string;
      bbox?: { x: number; y: number; width: number; height: number };
      confidence?: number;
    };

    return {
      rawOutput: {
        cutoutBase64: payload.cutout_b64 ?? null,
        bbox: payload.bbox ?? { x: 0.15, y: 0.15, width: 0.7, height: 0.7 },
        confidence: payload.confidence ?? 0.98,
      },
      tokensIn: 0,
      tokensOut: 0,
      images: 1,
      provider: "meta",
    };
  }

  // Text / Multimodal / Web Browse (Muse Spark & Muse Wonder)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: req.model,
      messages: buildMessages(req),
      temperature: req.step === "check_rules" || req.step === "verify_slide" ? 0.1 : 0.4,
      ...(req.expectJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new ProviderError(
      `Meta Model API (${req.model}) failed with HTTP ${response.status}: ${errText}`,
      { provider: "meta", statusCode: response.status },
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = payload.choices?.[0]?.message?.content ?? "";
  const tokensIn = payload.usage?.prompt_tokens ?? 350;
  const tokensOut = payload.usage?.completion_tokens ?? 180;

  return {
    rawOutput: content,
    tokensIn,
    tokensOut,
    images: 0,
    provider: "meta",
  };
}


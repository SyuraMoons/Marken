import type {
  CanonicalModelId,
  ProviderRawResponse,
  ProviderRequest,
} from "../types";

/**
 * Maps internal canonical model IDs (`SRD v2.0 §4`) to live Meta Model API (`https://api.meta.ai/v1`) IDs.
 */
export const LIVE_META_MODEL_IDS: Record<CanonicalModelId, string> = {
  "muse-spark": "muse-spark-1.3",
  "muse-wonder": "muse-wonder-1.0",
  "muse-spark-open": "muse-spark-1.3-contributor",
  "muse-image": "muse-image-1.0",
  "sam-3.1": "sam-3.1",
};

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

export function sanitizeBaseUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim().replace(/^["']|["']$/g, "");
  // Guard against accidental duplicate paste in .env (e.g., "https://api.meta.ai/v1https://api.meta.ai/v1")
  const match = trimmed.match(/^(https?:\/\/[^\s"']+?)(?=https?:\/\/|$)/);
  return (match ? match[1] : trimmed).replace(/\/+$/, "");
}

export function isMetaConfigured(): boolean {
  return Boolean(
    process.env.META_MODEL_API_KEY?.trim() &&
      sanitizeBaseUrl(process.env.META_MODEL_API_BASE_URL) &&
      process.env.GATEWAY_MODE !== "mock",
  );
}

function readImageUrls(obj: Record<string, unknown>): string[] {
  const imageUrls: string[] = [];
  if (typeof obj.imageUrl === "string" && obj.imageUrl.trim()) {
    imageUrls.push(obj.imageUrl.trim());
  }
  if (Array.isArray(obj.imageUrls)) {
    for (const u of obj.imageUrls) {
      if (typeof u === "string" && u.trim()) imageUrls.push(u.trim());
    }
  }
  return imageUrls;
}

/**
 * Number of images a chat request carries, so vision steps are billed per image.
 */
export function countInputImages(input: unknown): number {
  if (Array.isArray(input)) {
    return input.filter(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "image_url",
    ).length;
  }
  if (typeof input === "object" && input !== null) {
    return readImageUrls(input as Record<string, unknown>).length;
  }
  return 0;
}

/**
 * Builds OpenAI-style user content for every chat provider, so a vision step sends
 * real image parts on the fallback path too. Supports:
 * 1. Plain string prompts
 * 2. Multimodal input objects `{ prompt: string, imageUrl?: string, imageUrls?: string[] }`
 * 3. Pre-formatted OpenAI content arrays `Array<{ type: "text" | "image_url", ... }>`
 * 4. Arbitrary JSON objects (serialized as JSON string)
 */
export function buildUserContent(input: unknown): unknown {
  if (typeof input === "string") {
    return input;
  }
  if (Array.isArray(input)) {
    return input;
  }
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const imageUrls = readImageUrls(obj);
    if (imageUrls.length > 0) {
      const promptText =
        typeof obj.prompt === "string"
          ? obj.prompt
          : JSON.stringify(
              Object.fromEntries(
                Object.entries(obj).filter(
                  ([k]) => k !== "imageUrl" && k !== "imageUrls",
                ),
              ),
            );
      return [
        ...imageUrls.map((url) => ({
          type: "image_url",
          image_url: { url },
        })),
        {
          type: "text",
          text: promptText,
        },
      ];
    }
  }
  return JSON.stringify(input);
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
  messages.push({ role: "user", content: buildUserContent(req.input) });

  return messages;
}

/**
 * Calls the Meta Model API (`muse-spark-1.3`, `muse-wonder-1.0`, `muse-image-1.0`, `sam-3.1`).
 * Never import this outside `src/lib/gateway/`.
 */
export async function callMetaProvider(
  req: ProviderRequest,
): Promise<ProviderRawResponse> {
  const apiKey = process.env.META_MODEL_API_KEY?.trim();
  const baseUrl = sanitizeBaseUrl(process.env.META_MODEL_API_BASE_URL);

  if (!apiKey || !baseUrl) {
    throw new ProviderError(
      "META_MODEL_API_KEY or META_MODEL_API_BASE_URL is not configured",
      { provider: "meta", retriable: true },
    );
  }

  const liveModelId = LIVE_META_MODEL_IDS[req.model];

  // Image generation (Muse Image 1.0 — 1080x1350 scene with reserved empty product area)
  if (req.model === "muse-image") {
    const inputObj =
      typeof req.input === "object" && req.input !== null
        ? (req.input as Record<string, unknown>)
        : { prompt: String(req.input) };

    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: liveModelId,
        prompt: String(inputObj.prompt ?? req.input),
        size: String(inputObj.size ?? "1080x1350"),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ProviderError(
        `Meta Model API (${liveModelId}) failed with HTTP ${response.status}: ${errText}`,
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

  // Product cutout segmentation (SAM 3.1 via /v1/responses)
  if (req.model === "sam-3.1") {
    const inputObj =
      typeof req.input === "object" && req.input !== null
        ? (req.input as Record<string, unknown>)
        : { imageUrl: String(req.input), prompt: "product" };

    const imageUrl = String(
      inputObj.imageUrl ?? inputObj.image ?? req.input ?? "",
    );
    const labelPrompt = String(
      inputObj.prompt ?? inputObj.labelHint ?? "main product",
    );

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: liveModelId,
        input: [
          {
            role: "user",
            content: [
              { type: "input_image", image_url: imageUrl },
              { type: "input_text", text: labelPrompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new ProviderError(
        `Meta Model API (${liveModelId}) failed with HTTP ${response.status}: ${errText}`,
        { provider: "meta", statusCode: response.status },
      );
    }

    const payload = (await response.json()) as {
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        images_processed?: number;
      };
    };

    const outputText =
      payload.output?.[0]?.content?.find((c) => c.type === "output_text")
        ?.text ?? "";

    // Parse `<|box;x1=...;y1=...;x2=...;y2=...;w=...;h=...|>` and `<|mask;x=...;y=...;data=...|>`
    const boxMatch = outputText.match(
      /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)\|>/,
    );
    const maskMatch = outputText.match(
      /<\|mask;x=(\d+);y=(\d+);data=([^|]+)\|>/,
    );

    let bbox = { x: 0.15, y: 0.15, width: 0.7, height: 0.7 };
    let pixelBox:
      | { x1: number; y1: number; x2: number; y2: number; w: number; h: number }
      | undefined;

    if (boxMatch) {
      const x1 = Number(boxMatch[1]);
      const y1 = Number(boxMatch[2]);
      const x2 = Number(boxMatch[3]);
      const y2 = Number(boxMatch[4]);
      const w = Math.max(1, Number(boxMatch[5]));
      const h = Math.max(1, Number(boxMatch[6]));
      pixelBox = { x1, y1, x2, y2, w, h };
      bbox = {
        x: Number((x1 / w).toFixed(4)),
        y: Number((y1 / h).toFixed(4)),
        width: Number((Math.max(1, x2 - x1) / w).toFixed(4)),
        height: Number((Math.max(1, y2 - y1) / h).toFixed(4)),
      };
    }

    return {
      rawOutput: {
        cutoutBase64: null,
        rawSegmentationText: outputText,
        maskData: maskMatch ? maskMatch[3] : null,
        pixelBox: pixelBox ?? null,
        bbox,
        confidence: boxMatch ? 0.98 : 0.75,
      },
      tokensIn: payload.usage?.input_tokens ?? 0,
      tokensOut: payload.usage?.output_tokens ?? 0,
      images: payload.usage?.images_processed ?? 1,
      provider: "meta",
    };
  }

  // Text / Multimodal / Web Browse (`muse-spark-1.3` & `muse-wonder-1.0`)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: liveModelId,
      messages: buildMessages(req),
      temperature:
        req.step === "check_rules" || req.step === "verify_slide" ? 0.1 : 0.4,
      ...(req.expectJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new ProviderError(
      `Meta Model API (${liveModelId}) failed with HTTP ${response.status}: ${errText}`,
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
    images: countInputImages(req.input),
    provider: "meta",
  };
}



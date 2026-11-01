// Daily Trend Engine (SRD v2.0 §7.3 — FR-TR-01, FR-TR-03..06, F-06, F-07, F-16).
// 1. `researchTrends`: Browses public TikTok Creative Center & Google Trends via `Muse Wonder`
//    (`muse-wonder-1.0`), with explicit logged fallback to `Muse Spark` web search (`FR-TR-01`).
// 2. `scoreTrendCandidates`: Scores candidates 0-100 (`60% fitScore + 40% momentumScore`) via
//    `Muse Spark Open` (`muse-spark-1.3-contributor`) with a 3-Tier "Never Miss a Morning"
//    guarantee so every active shop always gets a post (`FR-TR-05`, `NFR-15`).
// 3. `analyseTrend`: Multimodal 7-day cacheable trend brief via `Muse Spark` (`muse-spark-1.3`),
//    reusing unexpired cached analyses across all shops at $0.00 cost (`FR-TR-03..06`).

import type { z } from "zod";
import { callModelWithTelemetry, type ModelCallTelemetry } from "../gateway";
import {
  TrendAnalysisModelSchema,
  TrendResearchModelSchema,
  TrendScoreModelSchema,
} from "./schemas";

export const DEFAULT_TREND_SCORE_THRESHOLD = 60;
export const TREND_CACHE_TTL_DAYS = 7;

export type TrendSource = "tiktok_creative_center" | "google_trends" | string;
export type TrendType = "format" | "topic" | "hashtag" | "sound" | string;

/**
 * Trend candidate matching `public.trends` table in Supabase (`SRD v2.0 §9`).
 */
export type TrendCandidate = {
  id?: string;
  source: TrendSource;
  type: TrendType;
  country: string;
  category: string;
  title: string;
  url: string;
  source_rank: number;
  collected_at: string;
};

export type ScoredTrendCandidate = TrendCandidate & {
  /** Weighted 0-100 integer score (`round(0.6 * fitScore + 0.4 * momentumScore)`) */
  score: number;
  /** 0-100 physical product & 3-slide carousel fit score (60% weight) */
  fitScore: number;
  /** 0-100 current velocity & buyer intent score (40% weight) */
  momentumScore: number;
  /** Plain-language explanation of the score */
  rationale: string;
};

/**
 * 7-day cached trend analysis matching `public.trend_analyses` (`SRD v2.0 §9`, `FR-TR-03..06`).
 */
export type TrendAnalysis = {
  trend_id?: string;
  hook: string;
  structure: string;
  visual_style: string;
  scene_brief: string;
  why_it_works: string;
  from_video: boolean;
  model: string;
  /** Public source URL preserved for the "Trend source" link on Today (`FR-TR-06`) */
  source_url: string;
  /** ISO timestamp 7 days from creation (`FR-TR-04`) */
  expires_at: string;
};

export type ResearchTrendsInput = {
  country: string;
  category: string;
  shopId?: string;
  postId?: string;
  /** Optional test hook to verify `Muse Wonder` -> `Muse Spark` fallback (`FR-TR-01`) */
  simulateWonderFailure?: boolean;
};

export type ResearchTrendsResult = {
  candidates: TrendCandidate[];
  pagesVisited: string[];
  usedMuseSparkFallback: boolean;
  fallbackReason?: string;
  telemetry: ModelCallTelemetry[];
};

export type ScoreTrendsOptions = {
  /** Minimum 0-100 score required to pass into `passingCandidates` (default: 60) */
  threshold?: number;
  /** Maximum number of top passing candidates to keep for analysis (default: 3) */
  maxPassing?: number;
  shopId?: string;
  postId?: string;
};

export type ScoreTrendsResult = {
  /** All candidates with their 0-100 `score`, `fitScore`, `momentumScore`, sorted highest first */
  candidates: ScoredTrendCandidate[];
  /** Candidates meeting `score >= threshold` (or top-fit fallback when `guaranteedFallback` is true) */
  passingCandidates: ScoredTrendCandidate[];
  /** True when Tier-3 "Never Miss a Morning" guarantee promoted the #1 fit candidate because all raw scores were `< threshold` */
  guaranteedFallback: boolean;
  thresholdUsed: number;
  telemetry: ModelCallTelemetry[];
};

export type ResearchAndScoreTrendsInput = ResearchTrendsInput & ScoreTrendsOptions;

export type ResearchAndScoreTrendsResult = {
  candidates: ScoredTrendCandidate[];
  passingCandidates: ScoredTrendCandidate[];
  pagesVisited: string[];
  usedMuseSparkFallback: boolean;
  guaranteedFallback: boolean;
  telemetry: ModelCallTelemetry[];
  totalCostUsd: number;
  totalLatencyMs: number;
};

export type AnalyseTrendInput = {
  trend: Pick<TrendCandidate, "title" | "url"> &
    Partial<Pick<ScoredTrendCandidate, "id" | "source" | "type" | "country" | "category" | "score" | "rationale">>;
  /**
   * Optional existing row from `public.trend_analyses` (`FR-TR-04`).
   * If present and `new Date(cachedAnalysis.expires_at) > now`, zero new model calls are made.
   */
  cachedAnalysis?: Partial<TrendAnalysis> | null;
  shopId?: string;
  postId?: string;
};

export type AnalyseTrendResult = {
  analysis: TrendAnalysis;
  cacheHit: boolean;
  telemetry: ModelCallTelemetry;
};

const DEFAULT_TIKTOK_URL =
  "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en";
const DEFAULT_GOOGLE_TRENDS_URL = "https://trends.google.com/trends/";

function normalizeSourceUrl(url: string | undefined, source: string): string {
  const trimmed = (url ?? "").trim();
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    return trimmed;
  }
  return source.toLowerCase().includes("google")
    ? DEFAULT_GOOGLE_TRENDS_URL
    : DEFAULT_TIKTOK_URL;
}

function buildEvergreenCandidate(
  country: string,
  category: string,
): TrendCandidate {
  return {
    source: "tiktok_creative_center",
    type: "format",
    country,
    category,
    title: `3-Second Sensory Close-Up & Hero Product Spotlight (${category})`,
    url: DEFAULT_TIKTOK_URL,
    source_rank: 1,
    collected_at: new Date().toISOString(),
  };
}

/**
 * `T-4.1` — Daily Trend Research Agent (`FR-TR-01`, `FR-TR-06`).
 * Uses `Muse Wonder` (`muse-wonder-1.0`) to collect public TikTok Creative Center and
 * Google Trends candidates for `(country, category)`. Automatically falls back to
 * `Muse Spark` (`muse-spark-1.3`) web search and logs the fallback if `Muse Wonder` fails.
 */
export async function researchTrends(
  inputOrCountry: ResearchTrendsInput | string,
  categoryArg?: string,
): Promise<ResearchTrendsResult> {
  const input: ResearchTrendsInput =
    typeof inputOrCountry === "string"
      ? {
          country: inputOrCountry,
          category: categoryArg ?? "General Retail",
        }
      : inputOrCountry;

  const country = input.country.trim() || "ID";
  const category = input.category.trim() || "General Retail";
  const collectedAt = new Date().toISOString();

  const systemPrompt = [
    "You are MARKEN's Daily Trend Research Agent (FR-TR-01).",
    "Browse and identify 4 to 6 current public marketing trends from TikTok Creative Center (`tiktok_creative_center`) and Google Trends (`google_trends`) for small businesses selling physical products in the given country and category.",
    "Focus on visual formats, hooks, and buyer-intent topics that work well for a 3-slide 1080x1350 Instagram product carousel.",
    "Every candidate MUST include a real, public source URL (`https://ads.tiktok.com/business/creativecenter/...` or `https://trends.google.com/trends/...`).",
    'Respond strictly with valid JSON matching: { "candidates": [{ "source": "tiktok_creative_center" | "google_trends", "type": "format" | "topic" | "hashtag" | "sound", "title": string, "url": string, "source_rank": number }], "pagesVisited": string[] }.',
  ].join("\n");

  const userPrompt = JSON.stringify({
    country,
    category,
    sourcesRequired: ["tiktok_creative_center", "google_trends"],
    targetFormat: "3-slide 1080x1350 physical product Instagram carousel",
  });

  const telemetryList: ModelCallTelemetry[] = [];
  let rawData: z.infer<typeof TrendResearchModelSchema>;
  let usedMuseSparkFallback = false;
  let fallbackReason: string | undefined;

  try {
    if (input.simulateWonderFailure) {
      throw new Error("Simulated Muse Wonder browsing timeout");
    }

    const wonderRes = await callModelWithTelemetry<
      string,
      z.infer<typeof TrendResearchModelSchema>
    >({
      step: "research_trends",
      model: "muse-wonder",
      shopId: input.shopId,
      postId: input.postId,
      systemPrompt,
      schema: TrendResearchModelSchema,
      allowFallback: false, // Catch here so we explicitly route fallback to Muse Spark web search per FR-TR-01
      input: userPrompt,
    });

    rawData = wonderRes.data;
    telemetryList.push(wonderRes.telemetry);
  } catch (wonderErr) {
    usedMuseSparkFallback = true;
    fallbackReason =
      wonderErr instanceof Error ? wonderErr.message : String(wonderErr);

    const sparkRes = await callModelWithTelemetry<
      string,
      z.infer<typeof TrendResearchModelSchema>
    >({
      step: "research_trends",
      model: "muse-spark",
      shopId: input.shopId,
      postId: input.postId,
      systemPrompt: `${systemPrompt}\n\nFALLBACK MODE (FR-TR-01): Muse Wonder browsing failed (${fallbackReason}). Use Muse Spark web search knowledge to return current TikTok Creative Center & Google Trends candidates.`,
      schema: TrendResearchModelSchema,
      input: userPrompt,
    });

    rawData = sparkRes.data;
    telemetryList.push({
      ...sparkRes.telemetry,
      fallback: true,
      fallbackReason: `Muse Wonder -> Muse Spark fallback: ${fallbackReason}`,
    });
  }

  const candidates: TrendCandidate[] = rawData.candidates.map((c, idx) => ({
    source: c.source,
    type: c.type,
    country,
    category,
    title: c.title.trim(),
    url: normalizeSourceUrl(c.url, c.source),
    source_rank: c.source_rank ?? idx + 1,
    collected_at: collectedAt,
  }));

  const pagesVisited = Array.from(
    new Set([
      ...rawData.pagesVisited.filter((u) => /^https?:\/\//i.test(u.trim())),
      ...candidates.map((c) => c.url),
    ]),
  );

  return {
    candidates,
    pagesVisited,
    usedMuseSparkFallback,
    fallbackReason,
    telemetry: telemetryList,
  };
}

/**
 * Scores a single trend candidate 0-100 using `Muse Spark Open` (`FR-TR-05`, `F-16`).
 * Weighted rubric: `score = round(0.6 * fitScore + 0.4 * momentumScore)`.
 */
export async function scoreTrendCandidate(
  candidate: TrendCandidate,
  category: string,
  options?: Pick<ScoreTrendsOptions, "shopId" | "postId">,
): Promise<{
  scored: ScoredTrendCandidate;
  telemetry: ModelCallTelemetry;
}> {
  const systemPrompt = [
    "You are MARKEN's Trend Scoring Agent (FR-TR-05).",
    "Score the trend candidate from 0 to 100 on two dimensions:",
    "1. `fitScore` (0-100, 60% weight): How well can a small physical-product seller execute this trend in a 3-slide static 1080x1350 Instagram carousel using their real product cutout (without needing a dance, skit, or face-cam) in the given category?",
    "2. `momentumScore` (0-100, 40% weight): Current velocity, source rank, and commercial buyer intent (save/order potential).",
    'Respond strictly with valid JSON: { "score": number, "fitScore": number, "momentumScore": number, "rationale": string }.',
  ].join("\n");

  const { data, telemetry } = await callModelWithTelemetry<
    string,
    z.infer<typeof TrendScoreModelSchema>
  >({
    step: "score_trend",
    model: "muse-spark-open",
    shopId: options?.shopId,
    postId: options?.postId,
    systemPrompt,
    schema: TrendScoreModelSchema,
    input: JSON.stringify({
      category,
      country: candidate.country,
      source: candidate.source,
      type: candidate.type,
      title: candidate.title,
      source_rank: candidate.source_rank,
    }),
  });

  const fitScore = Math.max(0, Math.min(100, Math.round(data.fitScore)));
  const momentumScore = Math.max(
    0,
    Math.min(100, Math.round(data.momentumScore)),
  );
  // Enforce deterministic 60% Fit / 40% Momentum KPI weighting
  const weightedScore = Math.max(
    0,
    Math.min(100, Math.round(0.6 * fitScore + 0.4 * momentumScore)),
  );

  return {
    scored: {
      ...candidate,
      score: weightedScore,
      fitScore,
      momentumScore,
      rationale: data.rationale.trim(),
    },
    telemetry,
  };
}

/**
 * `T-4.2` — Scores a batch of trend candidates 0-100 and applies the 3-Tier
 * "Never Miss a Morning" guarantee (`FR-TR-05`, `NFR-15`).
 */
export async function scoreTrendCandidates(
  candidates: TrendCandidate[],
  category: string,
  options?: ScoreTrendsOptions,
): Promise<ScoreTrendsResult> {
  const threshold = options?.threshold ?? DEFAULT_TREND_SCORE_THRESHOLD;
  const maxPassing = options?.maxPassing ?? 3;

  const effectiveCandidates =
    candidates.length > 0
      ? candidates
      : [buildEvergreenCandidate("ID", category)];

  const results = await Promise.all(
    effectiveCandidates.map((c) =>
      scoreTrendCandidate(c, category, {
        shopId: options?.shopId,
        postId: options?.postId,
      }),
    ),
  );

  const scored = results
    .map((r) => r.scored)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      return a.source_rank - b.source_rank;
    });

  const telemetry = results.map((r) => r.telemetry);

  let passingCandidates = scored
    .filter((c) => c.score >= threshold)
    .slice(0, maxPassing);
  let guaranteedFallback = false;

  // Tier 3 "Never Miss a Morning" Guarantee (Pillar 2 NFR-15):
  // If no candidate met `score >= threshold`, promote the #1 highest-fit candidate so
  // the daily carousel loop never stalls on an empty trend list.
  if (passingCandidates.length === 0 && scored.length > 0) {
    const bestByFit = [...scored].sort((a, b) => b.fitScore - a.fitScore)[0];
    passingCandidates = [bestByFit];
    guaranteedFallback = true;
  }

  return {
    candidates: scored,
    passingCandidates,
    guaranteedFallback,
    thresholdUsed: threshold,
    telemetry,
  };
}

/**
 * Combined contract for Harfi's `trends.daily` Inngest cron (`docs/TEAM.md` §2):
 * Runs `researchTrends` -> `scoreTrendCandidates` and returns scored & passing trends.
 */
export async function researchAndScoreTrends(
  inputOrCountry: ResearchAndScoreTrendsInput | string,
  categoryArg?: string,
): Promise<ResearchAndScoreTrendsResult> {
  const startedAt = Date.now();
  const input: ResearchAndScoreTrendsInput =
    typeof inputOrCountry === "string"
      ? {
          country: inputOrCountry,
          category: categoryArg ?? "General Retail",
        }
      : inputOrCountry;

  const research = await researchTrends(input);
  const scored = await scoreTrendCandidates(
    research.candidates,
    input.category,
    {
      threshold: input.threshold,
      maxPassing: input.maxPassing,
      shopId: input.shopId,
      postId: input.postId,
    },
  );

  const allTelemetry = [...research.telemetry, ...scored.telemetry];
  const totalCostUsd = Number(
    allTelemetry.reduce((sum, t) => sum + t.costUsd, 0).toFixed(6),
  );
  const totalLatencyMs = Math.max(1, Date.now() - startedAt);

  return {
    candidates: scored.candidates,
    passingCandidates: scored.passingCandidates,
    pagesVisited: research.pagesVisited,
    usedMuseSparkFallback: research.usedMuseSparkFallback,
    guaranteedFallback: scored.guaranteedFallback,
    telemetry: allTelemetry,
    totalCostUsd,
    totalLatencyMs,
  };
}

function isCacheEntryValid(
  cached: Partial<TrendAnalysis> | null | undefined,
): cached is Partial<TrendAnalysis> & {
  hook: string;
  structure: string;
  visual_style: string;
  scene_brief: string;
  why_it_works: string;
  expires_at: string;
} {
  if (!cached) return false;
  if (
    !cached.hook?.trim() ||
    !cached.structure?.trim() ||
    !cached.visual_style?.trim() ||
    !cached.scene_brief?.trim() ||
    !cached.why_it_works?.trim() ||
    !cached.expires_at
  ) {
    return false;
  }
  const expiresMs = new Date(cached.expires_at).getTime();
  return Number.isFinite(expiresMs) && expiresMs > Date.now();
}

/**
 * `T-4.3` — 7-Day Shared Trend Multimodal Analysis (`FR-TR-03`, `FR-TR-04`, `FR-TR-06`, `F-07`).
 * If a valid unexpired `cachedAnalysis` is supplied, serves it through the gateway with
 * `cacheHit: true` and `costUsd: 0` (`FR-TR-04`). Otherwise analyses the trend once with
 * `Muse Spark` (`muse-spark-1.3`) and sets a 7-day `expires_at` timestamp.
 */
export async function analyseTrend(
  input: AnalyseTrendInput,
): Promise<AnalyseTrendResult> {
  const sourceUrl = normalizeSourceUrl(
    input.trend.url,
    input.trend.source ?? "tiktok_creative_center",
  );

  // Shared 7-Day Cache Hit Path (FR-TR-04): Second shop triggers zero new model calls ($0.00)
  if (isCacheEntryValid(input.cachedAnalysis)) {
    const cached = input.cachedAnalysis;
    const { data, telemetry } = await callModelWithTelemetry<
      unknown,
      z.infer<typeof TrendAnalysisModelSchema>
    >({
      step: "analyse_trend",
      model: "muse-spark",
      shopId: input.shopId,
      postId: input.postId,
      schema: TrendAnalysisModelSchema,
      cacheHit: true,
      cachedOutput: {
        hook: cached.hook,
        structure: cached.structure,
        visual_style: cached.visual_style,
        scene_brief: cached.scene_brief,
        why_it_works: cached.why_it_works,
        from_video: cached.from_video ?? true,
      },
      input: { trendTitle: input.trend.title, cacheHit: true },
    });

    return {
      analysis: {
        trend_id: cached.trend_id ?? input.trend.id,
        hook: data.hook,
        structure: data.structure,
        visual_style: data.visual_style,
        scene_brief: data.scene_brief,
        why_it_works: data.why_it_works,
        from_video: data.from_video,
        model: cached.model ?? "muse-spark-1.3",
        source_url: cached.source_url ?? sourceUrl,
        expires_at: cached.expires_at,
      },
      cacheHit: true,
      telemetry,
    };
  }

  // Fresh Analysis via Muse Spark (FR-TR-03)
  const systemPrompt = [
    "You are MARKEN's Trend Analysis Agent (FR-TR-03).",
    "Analyse the trending format/topic once so any physical-product shop in this category can reuse the creative brief for 7 days.",
    "Return:",
    "- `hook`: Scroll-stopping Slide 1 headline pattern (concise, high curiosity/appetite/desire).",
    "- `structure`: 3-slide carousel flow (Slide 1 Hook -> Slide 2 Product Proof -> Slide 3 Direct Order CTA).",
    "- `visual_style`: Lighting, surface texture, color palette, and mood.",
    "- `scene_brief`: Background scene description for Muse Image 1.0 (1080x1350) that leaves the CENTRAL PRODUCT AREA COMPLETELY EMPTY for deterministic product cutout compositing (FR-CG-04).",
    "- `why_it_works`: Plain-language 1-sentence reason shown to the shop owner on `/today` explaining why this trend drives engagement.",
    "- `from_video`: true if originates from short-form video (TikTok), false for search/text topic.",
    'Respond strictly with valid JSON: { "hook": string, "structure": string, "visual_style": string, "scene_brief": string, "why_it_works": string, "from_video": boolean }.',
  ].join("\n");

  const { data, telemetry } = await callModelWithTelemetry<
    string,
    z.infer<typeof TrendAnalysisModelSchema>
  >({
    step: "analyse_trend",
    model: "muse-spark",
    shopId: input.shopId,
    postId: input.postId,
    systemPrompt,
    schema: TrendAnalysisModelSchema,
    input: JSON.stringify({
      title: input.trend.title,
      source: input.trend.source ?? "tiktok_creative_center",
      type: input.trend.type ?? "format",
      country: input.trend.country ?? "ID",
      category: input.trend.category ?? "General Retail",
      url: sourceUrl,
    }),
  });

  const expiresAt = new Date(
    Date.now() + TREND_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  return {
    analysis: {
      trend_id: input.trend.id,
      hook: data.hook.trim(),
      structure: data.structure.trim(),
      visual_style: data.visual_style.trim(),
      scene_brief: data.scene_brief.trim(),
      why_it_works: data.why_it_works.trim(),
      from_video: data.from_video,
      model: "muse-spark-1.3",
      source_url: sourceUrl,
      expires_at: expiresAt,
    },
    cacheHit: false,
    telemetry,
  };
}


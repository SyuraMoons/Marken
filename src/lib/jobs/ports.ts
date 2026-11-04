import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  researchAndScoreTrends as agentResearchAndScore,
  analyseTrend as agentAnalyseTrend,
} from "@/lib/agents/trends";
import { planDailyCarousel as agentPlanDailyCarousel } from "@/lib/agents/planner";
import { renderAndVerifySlide as studioRenderAndVerifySlide } from "@/lib/studio";
import { regenerateCaptionFromFeedback as agentRegenerateCaption } from "@/lib/agents/caption";
import type { BrandStyle, SlideLayers, TemplateId } from "@/lib/studio/layers";
import type { FramingMode } from "@/lib/studio/composite";

// The AI steps the jobs call (docs/TEAM.md §2).
// Wired to the real modules:
// - `agents/trends.ts` (researchAndScoreTrends, analyseTrend)
// - `agents/planner.ts` (planDailyCarousel)
// - `studio/index.ts` (renderAndVerifySlide)
// - `agents/caption.ts` (regenerateCaption)
// Image failures propagate to the job status; unverified substitutes are never returned.

export type TrendCandidate = {
  source: string;
  type: string | null;
  title: string;
  url: string | null;
  rank: number | null;
  score: number; // 0-100
};

export type TrendAnalysisResult = {
  hook: string;
  structure: string;
  visualStyle: string;
  sceneBrief: string;
  whyItWorks: string;
  fromVideo: boolean;
  model: string;
};

export type PlanInput = {
  shop: {
    id: string;
    name: string | null;
    tone: string | null;
    contentLanguage: "en" | "id";
    styleRules: string[];
  };
  products: { id: string; name: string | null; cutoutPath: string | null }[];
  trend: { id: string; title: string } & TrendAnalysisResult;
  postId: string;
  /** Owner's brief from the create flow (FD-46). */
  brief?: string;
};

/** Template fields come from the planner (headline, subline, big word, layout); all optional. */
export type CarouselSlide = {
  order: number;
  role: "hook" | "product" | "cta";
  text: string;
  alt: string;
  sceneBrief: string;
  headline?: string;
  subline?: string;
  bigWord?: string;
  categoryTag?: string;
  framingMode?: FramingMode;
  cameraAngle?: string;
  surfaceType?: string;
  templateId?: TemplateId;
};

export type CarouselPlan = {
  productId: string;
  fitReason: string;
  slides: CarouselSlide[];
  captions: { label: string; text: string }[];
  hashtags: string[];
};

export type RenderedSlide = {
  scenePng: Buffer;
  slidePng: Buffer;
  fidelityScore: number;
  fidelityPassed: boolean;
  /** Editable layers (SRD A-09); absent only when a test double omits them. */
  layers?: SlideLayers;
};

export type RenderSlideInput = {
  order: number;
  text: string;
  sceneBrief: string;
  role?: "hook" | "product" | "cta";
  alt?: string;
  headline?: string;
  subline?: string;
  bigWord?: string;
  categoryTag?: string;
  framingMode?: FramingMode;
  cameraAngle?: string;
  surfaceType?: string;
  templateId?: TemplateId;
  cutout?: Buffer;
  cutoutPath?: string | null;
  shopId?: string;
  postId?: string;
  shopTone?: string;
  styleRules?: string[];
  contentLanguage?: "en" | "id";
  brand?: BrandStyle;
};

export async function researchAndScoreTrends(input: {
  country: string;
  category: string;
}): Promise<TrendCandidate[]> {
  try {
    const res = await agentResearchAndScore({
      country: input.country || "ID",
      category: input.category || "physical products",
      threshold: 60,
    });
    if (res.candidates && res.candidates.length > 0) {
      return res.candidates.map((c, idx) => ({
        source: c.source ?? "tiktok_creative_center",
        type: c.type ?? "format",
        title: c.title,
        url: c.url ?? null,
        rank: c.source_rank ?? idx + 1,
        score: Math.round(c.score),
      }));
    }
  } catch (error) {
    console.error("[ports.researchAndScoreTrends] Real agent call failed, using resilient fallback:", error);
  }

  // Resilient fallback when offline/mock mode or API unreachable (NFR-15: Never Miss a Morning)
  const label = input.category || "general";
  return [
    { source: "tiktok_creative_center", type: "format", title: `${label} behind-the-scenes reel`, url: null, rank: 1, score: 82 },
    { source: "tiktok_creative_center", type: "format", title: `${label} before and after`, url: null, rank: 2, score: 74 },
    { source: "google_trends", type: "topic", title: `${label} slow morning routine`, url: null, rank: 3, score: 65 },
  ];
}

export async function analyseTrend(trend: {
  id?: string;
  title: string;
  url?: string | null;
  source?: string | null;
}): Promise<TrendAnalysisResult> {
  try {
    const res = await agentAnalyseTrend({
      trend: {
        id: trend.id,
        title: trend.title,
        url: trend.url ?? "",
        source:
          trend.source === "google_trends"
            ? "google_trends"
            : "tiktok_creative_center",
      },
    });
    if (res.analysis) {
      return {
        hook: res.analysis.hook,
        structure: res.analysis.structure,
        visualStyle: res.analysis.visual_style,
        sceneBrief: res.analysis.scene_brief,
        whyItWorks: res.analysis.why_it_works,
        fromVideo: res.analysis.from_video,
        model: res.analysis.model,
      };
    }
  } catch (error) {
    console.error("[ports.analyseTrend] Real agent call failed, using resilient fallback:", error);
  }

  return {
    hook: `Stop scrolling: ${trend.title}`,
    structure: "hook, product moment, call to action",
    visualStyle: "warm natural light, clean surface",
    sceneBrief: `Clean tabletop scene inspired by "${trend.title}" with an empty area for the product.`,
    whyItWorks: "Familiar format with a clear payoff in the first second.",
    fromVideo: false,
    model: "mock-fallback",
  };
}

export async function planDailyCarousel(input: PlanInput): Promise<CarouselPlan> {
  try {
    const res = await agentPlanDailyCarousel({
      shop: {
        id: input.shop.id,
        name: input.shop.name,
        tone: input.shop.tone,
        contentLanguage: input.shop.contentLanguage,
        styleRules: input.shop.styleRules,
      },
      products: input.products.map((p) => ({
        id: p.id,
        name: p.name,
        cutoutPath: p.cutoutPath,
      })),
      trend: {
        id: input.trend.id,
        title: input.trend.title,
        hook: input.trend.hook,
        structure: input.trend.structure,
        visualStyle: input.trend.visualStyle,
        sceneBrief: input.trend.sceneBrief,
        whyItWorks: input.trend.whyItWorks,
        fromVideo: input.trend.fromVideo,
      },
      postId: input.postId,
      brief: input.brief,
    });

    if (res && res.slides && res.slides.length > 0) {
      return {
        productId: res.productId,
        fitReason: res.fitReason,
        slides: res.slides.map((s) => ({
          order: s.order,
          role: s.role,
          text: s.text,
          alt: s.alt,
          sceneBrief: s.sceneBrief,
          headline: s.headline,
          subline: s.subline,
          bigWord: s.bigWord,
          templateId: s.templateId,
        })),
        captions: res.captions.map((c) => ({
          label: c.label,
          text: c.text,
        })),
        hashtags: res.hashtags,
      };
    }
  } catch (error) {
    console.error("[ports.planDailyCarousel] Real planner call failed, using resilient fallback:", error);
  }

  const product = input.products[0] ?? { id: "product-default", name: "our product", cutoutPath: null };
  const name = product.name ?? "our product";
  return {
    productId: product.id,
    fitReason: `"${input.trend.title}" suits ${name}.`,
    slides: [
      { order: 1, role: "hook", text: input.trend.hook, alt: "Hook slide", sceneBrief: input.trend.sceneBrief },
      { order: 2, role: "product", text: name, alt: `${name} on a clean surface`, sceneBrief: input.trend.sceneBrief },
      { order: 3, role: "cta", text: "Order today", alt: "Call to action slide", sceneBrief: input.trend.sceneBrief },
    ],
    captions: [
      { label: "A", text: `${name}. ${input.trend.whyItWorks}` },
      { label: "B", text: `Meet ${name}.` },
    ],
    hashtags: ["smallbusiness", "shoplocal", "newpost", "handmade", "daily"],
  };
}

export async function renderAndVerifySlide(input: RenderSlideInput): Promise<RenderedSlide> {
  let cutoutBuffer: Buffer | undefined = input.cutout;

  // If cutout buffer not directly passed, attempt download from Supabase Storage
  if (!cutoutBuffer && input.cutoutPath) {
    // A Storage failure is infrastructure, not a bad product photo: surface the real cause.
    let cause: string;
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.storage.from("media").download(input.cutoutPath);
      if (error || !data) throw new Error(error?.message ?? "empty response");
      cutoutBuffer = Buffer.from(await data.arrayBuffer());
      cause = "";
    } catch (e) {
      cause = e instanceof Error ? e.message : String(e);
    }
    if (cause) {
      console.warn(`[ports.renderAndVerifySlide] Could not download cutout from ${input.cutoutPath}: ${cause}`);
      throw new Error(`Could not load the product cutout from storage (${cause}). Try again shortly.`);
    }
  }

  // Missing product pixels must fail the job, never become a verified blank slide.
  if (!cutoutBuffer?.length) throw new Error("Product cutout is unavailable. Confirm or upload the product photo again.");

  const res = await studioRenderAndVerifySlide({
    sceneBrief: input.sceneBrief,
    slideText: input.text,
    slideRole: input.role,
    headline: input.headline,
    subline: input.subline,
    bigWord: input.bigWord,
    categoryTag: input.categoryTag,
    framingMode: input.framingMode,
    cameraAngle: input.cameraAngle,
    surfaceType: input.surfaceType,
    templateId: input.templateId,
    cutout: cutoutBuffer,
    shopTone: input.shopTone,
    styleRules: input.styleRules,
    contentLanguage: input.contentLanguage,
    brand: input.brand,
    shopId: input.shopId,
    postId: input.postId,
  });
  return {
    layers: res.layers,
    scenePng: res.sceneBuffer,
    slidePng: res.slideBuffer,
    fidelityScore: res.fidelityScore,
    fidelityPassed: res.fidelityPassed,
  };
}

export async function regenerateCaption(input: {
  currentCaption: string | null;
  feedback: string;
  shopId?: string;
  postId?: string;
  shop?: {
    tone?: string | null;
    contentLanguage?: "en" | "id";
    styleRules?: string[];
  };
}): Promise<{ label: string; text: string }[]> {
  try {
    const res = await agentRegenerateCaption({
      currentCaption: input.currentCaption ?? "",
      feedback: input.feedback,
      shop: {
        tone: input.shop?.tone ?? "warm, authentic, engaging",
        contentLanguage: input.shop?.contentLanguage ?? "en",
        styleRules: input.shop?.styleRules ?? [],
      },
      postId: input.postId,
    });

    if (res && res.options && res.options.length > 0) {
      return res.options.map((c) => ({
        label: c.label,
        text: c.text,
      }));
    }
  } catch (error) {
    console.error("[ports.regenerateCaption] Real caption agent failed, using fallback:", error);
  }

  return [
    { label: "A", text: `${input.currentCaption ?? ""} (${input.feedback})`.trim() },
    { label: "B", text: input.feedback },
  ];
}

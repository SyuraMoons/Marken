import "server-only";
import sharp from "sharp";

// The AI steps the jobs call (docs/TEAM.md §2). Altaf's #4, #5 and #6 own the real
// implementations (agents/trends.ts, agents/planner.ts, studio/composite.ts and
// studio/fidelity.ts). Until they land, each port returns deterministic mock output so
// the orchestration can be built and demoed. To switch over, replace the body of one port
// with a call into the real module; the job code does not change.

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
};

export type CarouselPlan = {
  productId: string;
  fitReason: string;
  slides: { order: number; role: "hook" | "product" | "cta"; text: string; alt: string; sceneBrief: string }[];
  captions: { label: string; text: string }[];
  hashtags: string[];
};

export type RenderedSlide = {
  scenePng: Buffer;
  slidePng: Buffer;
  fidelityScore: number;
  fidelityPassed: boolean;
};

export async function researchAndScoreTrends(input: {
  country: string;
  category: string;
}): Promise<TrendCandidate[]> {
  const label = input.category || "general";
  return [
    { source: "mock", type: "format", title: `${label} behind-the-scenes reel`, url: null, rank: 1, score: 82 },
    { source: "mock", type: "format", title: `${label} before and after`, url: null, rank: 2, score: 74 },
    { source: "mock", type: "audio", title: `${label} slow morning routine`, url: null, rank: 3, score: 41 },
  ];
}

export async function analyseTrend(trend: { title: string }): Promise<TrendAnalysisResult> {
  return {
    hook: `Stop scrolling: ${trend.title}`,
    structure: "hook, product moment, call to action",
    visualStyle: "warm natural light, clean surface",
    sceneBrief: `Clean tabletop scene inspired by "${trend.title}" with an empty area for the product.`,
    whyItWorks: "Familiar format with a clear payoff in the first second.",
    fromVideo: false,
    model: "mock",
  };
}

export async function planDailyCarousel(input: PlanInput): Promise<CarouselPlan> {
  const product = input.products[0];
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

export async function renderAndVerifySlide(input: {
  order: number;
  text: string;
  sceneBrief: string;
}): Promise<RenderedSlide> {
  void input; // mock ignores the brief; the real port renders it
  const png = await sharp({
    create: { width: 1080, height: 1350, channels: 3, background: { r: 245, g: 240, b: 232 } },
  })
    .png()
    .toBuffer();
  return { scenePng: png, slidePng: png, fidelityScore: 0, fidelityPassed: false };
}

export async function regenerateCaption(input: {
  currentCaption: string | null;
  feedback: string;
}): Promise<{ label: string; text: string }[]> {
  return [
    { label: "A", text: `${input.currentCaption ?? ""} (${input.feedback})`.trim() },
    { label: "B", text: input.feedback },
  ];
}

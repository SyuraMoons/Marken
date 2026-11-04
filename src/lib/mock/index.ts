import type { Tables } from "@/lib/supabase/database.types";
import type { PostStatus } from "@/lib/posts/status";
import type { Slide } from "@/lib/posts/slides";

// Typed fixtures until Supabase reads land (FD-09). Swap callers to real queries, not this file.
export const mockUser: Pick<Tables<"users">, "email" | "name"> = { email: "rani@ranistudio.shop", name: "Rani" };

export const mockShop: Pick<Tables<"shops">, "id" | "name" | "onboarding_step" | "onboarding_completed_at" | "ig_account_id"> = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Rani Studio",
  onboarding_step: 5,
  onboarding_completed_at: "2026-11-01T00:05:00.000Z",
  ig_account_id: "17841400000000000",
};

const IMG = "/mock/sample-product.png";

const slides: Slide[] = [
  { order: 1, text: "A little glow, every day.", alt: "Serum bottle on a pink silk and stone set, headline: A little glow, every day.", scene_path: IMG, slide_path: IMG, fidelity_score: 0.99, fidelity_passed: true },
  { order: 2, text: "LUMI Daily Serum", alt: "Close view of the LUMI Daily Serum bottle on stone.", scene_path: IMG, slide_path: IMG, fidelity_score: 0.98, fidelity_passed: true },
  { order: 3, text: "Order via DM", alt: "Serum bottle with the call to action: Order via DM.", scene_path: IMG, slide_path: IMG, fidelity_score: 0.99, fidelity_passed: true },
];

const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 0, min)).toISOString();

export const mockPost: Tables<"posts"> = {
  id: "00000000-0000-0000-0000-0000000000a1",
  shop_id: mockShop.id,
  product_id: "00000000-0000-0000-0000-0000000000b1",
  trend_id: "00000000-0000-0000-0000-0000000000c1",
  post_date: "2026-11-01",
  status: "ready",
  fit_reason: "The “little daily ritual” format gives your serum a natural place in an everyday routine.",
  slides,
  caption_options: [
    "Sedikit kilau untuk harimu. ✨ Temukan LUMI Daily Serum untuk rutinitas harianmu.",
    "Momen kecil untuk dirimu. ✨ Lengkapi rutinitas pagimu dengan LUMI Daily Serum.",
  ],
  chosen_caption: null,
  hashtags: ["#LUMI", "#DailySerum", "#SkincareRoutine", "#RaniStudio", "#SelfCare"],
  skip_reason: null,
  ig_media_id: null,
  permalink: null,
  approved_at: null,
  published_at: null,
  created_at: at(0),
  updated_at: at(3),
};

export const mockTrend: Pick<Tables<"trends">, "title" | "url"> = {
  title: "Little daily ritual",
  url: "https://ads.tiktok.com/business/creativecenter/",
};

// Owner's original photo for the before/after view.
export const mockProductPhoto = { src: IMG, name: "LUMI Daily Serum" };

const product = (id: string, name: string, category: string, price: number | null): Tables<"products"> => ({
  id, shop_id: mockShop.id, name, category, price, currency: "IDR", attributes: {}, description: null,
  hidden: false, cutout_path: IMG, cutout_confirmed: false, source_upload_id: null, created_at: at(0), updated_at: at(0),
});

export const mockProducts: Tables<"products">[] = [
  product("00000000-0000-0000-0000-0000000000b1", "LUMI Daily Serum", "Beauty", 189000),
  product("00000000-0000-0000-0000-0000000000b2", "LUMI Glow Mist", "Beauty", null),
  product("00000000-0000-0000-0000-0000000000b3", "LUMI Travel Pouch", "Beauty", 95000),
];

const step = (s: string, model: string | null, start: number, end: number | null, status = "succeeded"): Tables<"post_steps"> => ({
  id: s, post_id: mockPost.id, shop_id: mockShop.id, step: s, model, status, started_at: at(start), finished_at: end === null ? null : at(end), detail: null,
});

export const mockSteps: Tables<"post_steps">[] = [
  step("plan_post", "Muse Spark", 0, 1),
  step("cutout", "SAM 3.1", 1, 1),
  step("render_image", "Muse Image", 1, 2),
  step("composite", null, 2, 2),
  step("fidelity_check", "Muse Spark", 2, 3),
];

export const mockCalls: Pick<Tables<"model_calls">, "step" | "latency_ms" | "cost_usd" | "cache_hit" | "fallback">[] = [
  { step: "analyse_trend", latency_ms: 0, cost_usd: 0.004, cache_hit: true, fallback: false },
  { step: "plan_post", latency_ms: 8200, cost_usd: 0.012, cache_hit: false, fallback: false },
  { step: "cutout", latency_ms: 2100, cost_usd: 0.003, cache_hit: false, fallback: false },
  { step: "render_image", latency_ms: 21400, cost_usd: 0.03, cache_hit: false, fallback: false },
  { step: "fidelity_check", latency_ms: 3600, cost_usd: 0.006, cache_hit: false, fallback: false },
];

// shortcut: dev-only ?status= preview of each Today state, delete with the mocks.
export function mockPostWith(status: string | undefined): Tables<"posts"> | null {
  if (status === "none") return null;
  const s = (status ?? "ready") as PostStatus;
  if (s === "skipped") return { ...mockPost, status: s, skip_reason: "bad_timing" };
  if (s === "published") return { ...mockPost, status: s, approved_at: at(5), published_at: at(6), permalink: "https://www.instagram.com/" };
  if (s === "failed") return { ...mockPost, status: s, approved_at: at(5) };
  if (status === "fidelity-failed") return { ...mockPost, status: "failed", slides: slides.map((x) => (x.order === 2 ? { ...x, fidelity_passed: false, fidelity_score: 0.71 } : x)) };
  return { ...mockPost, status: s, approved_at: s === "approved" || s === "publishing" ? at(5) : null };
}

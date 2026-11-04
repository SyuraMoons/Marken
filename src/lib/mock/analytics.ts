import type { MessageKey } from "@/lib/i18n";

export const ANALYTICS_DAYS = ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"] as const;
export type DemoPost = {
  id: string; platform: "instagram" | "facebook"; date: string;
  title: MessageKey; context: MessageKey; insight: MessageKey;
  reach: number; impressions: number; likes: number; comments: number; saves: number; shares: number; orders: number;
  dailyReach: number[];
};
export const DEMO_ANALYTICS: DemoPost[] = [
  { id: "ritual", platform: "instagram", date: "2026-11-02", title: "analytics.ritualTitle", context: "analytics.ritualContext", insight: "analytics.ritualInsight", reach: 1840, impressions: 2470, likes: 96, comments: 8, saves: 42, shares: 18, orders: 5, dailyReach: [0, 0, 0, 0, 600, 740, 500] },
  { id: "detail", platform: "instagram", date: "2026-10-31", title: "analytics.detailTitle", context: "analytics.detailContext", insight: "analytics.detailInsight", reach: 1260, impressions: 1780, likes: 64, comments: 5, saves: 31, shares: 11, orders: 3, dailyReach: [0, 0, 220, 340, 300, 220, 180] },
  { id: "travel", platform: "facebook", date: "2026-10-29", title: "analytics.travelTitle", context: "analytics.travelContext", insight: "analytics.travelInsight", reach: 980, impressions: 1370, likes: 38, comments: 3, saves: 12, shares: 7, orders: 1, dailyReach: [160, 260, 190, 130, 100, 80, 60] },
];

export function summarizeAnalytics(posts: DemoPost[]) {
  const total = (key: "reach" | "impressions" | "likes" | "comments" | "saves" | "shares" | "orders") => posts.reduce((sum, post) => sum + post[key], 0);
  const likes = total("likes"), comments = total("comments"), saves = total("saves"), shares = total("shares");
  return { reach: total("reach"), impressions: total("impressions"), likes, comments, saves, shares, orders: total("orders"), interactions: likes + comments + saves + shares, dailyReach: ANALYTICS_DAYS.map((_, i) => posts.reduce((sum, post) => sum + post.dailyReach[i], 0)) };
}


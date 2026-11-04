import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "./client";
import { analyseTrend, researchAndScoreTrends } from "./ports";

// Trends scoring below this are stored but never analysed (cost control).
const ANALYSE_MIN_SCORE = 60;
const ANALYSE_PER_PAIR = 3;
const CACHE_DAYS = 7;

type Pair = { country: string; category: string };

// Runs at 20:00 UTC: 03:00 in Jakarta, 16:00 the day before in California, so every shop
// has fresh trends before its morning post (default notify time 08:00 local).
// Cron trends.daily (F-06, F-16, F-07): research and score once per (country, category),
// then analyse the best trends. An analysis is cached 7 days for every shop (FR-TR-04),
// so a second shop on the same trend triggers zero new analysis calls.
export const trendsDaily = inngest.createFunction(
  { id: "trends-daily", retries: 2, triggers: [{ cron: "0 20 * * *" }] },
  async ({ step }) => {
    const pairs = await step.run("list-pairs", async (): Promise<Pair[]> => {
      const { data, error } = await createAdminClient()
        .from("shops")
        .select("country, category")
        .not("onboarding_completed_at", "is", null);
      if (error) throw new Error(error.message);
      const seen = new Map<string, Pair>();
      for (const s of data ?? []) {
        const pair = { country: s.country ?? "", category: s.category ?? "" };
        seen.set(`${pair.country}|${pair.category}`, pair);
      }
      return [...seen.values()];
    });

    const results: { pair: Pair; analysed: number; cached: number; error?: string }[] = [];

    // One step per pair: a failing pair retries alone and never blocks the others.
    for (const pair of pairs) {
      try {
        const outcome = await step.run(`trends-${pair.country}-${pair.category}`, () =>
          collectPair(pair),
        );
        results.push({ pair, ...outcome });
      } catch (error) {
        results.push({
          pair,
          analysed: 0,
          cached: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  },
);

export async function collectPair(pair: Pair) {
  const admin = createAdminClient();
  const candidates = await researchAndScoreTrends(pair);
  if (!candidates.length) return { analysed: 0, cached: 0 };

  // Upsert on the stable key so trend_id, and its cached analysis, survives re-collection.
  const { data: rows, error } = await admin
    .from("trends")
    .upsert(
      candidates.map((c) => ({
        source: c.source,
        type: c.type,
        country: pair.country,
        category: pair.category,
        title: c.title,
        url: c.url,
        source_rank: c.rank,
        score: Math.round(c.score),
        collected_at: new Date().toISOString(),
      })),
      { onConflict: "source,country,category,title" },
    )
    .select("id, title, score");
  if (error) throw new Error(error.message);

  const top = (rows ?? [])
    .filter((r) => (r.score ?? 0) >= ANALYSE_MIN_SCORE)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, ANALYSE_PER_PAIR);
  if (!top.length) return { analysed: 0, cached: 0 };

  const { data: fresh } = await admin
    .from("trend_analyses")
    .select("trend_id")
    .in("trend_id", top.map((t) => t.id))
    .gt("expires_at", new Date().toISOString());
  const cached = new Set((fresh ?? []).map((a) => a.trend_id));

  let analysed = 0;
  for (const trend of top) {
    if (cached.has(trend.id)) continue;
    const a = await analyseTrend(trend);
    const { error: saveError } = await admin.from("trend_analyses").upsert({
      trend_id: trend.id,
      hook: a.hook,
      structure: a.structure,
      visual_style: a.visualStyle,
      scene_brief: a.sceneBrief,
      why_it_works: a.whyItWorks,
      from_video: a.fromVideo,
      model: a.model,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_DAYS * 86_400_000).toISOString(),
    });
    if (saveError) throw new Error(saveError.message);
    analysed += 1;
  }
  return { analysed, cached: cached.size };
}

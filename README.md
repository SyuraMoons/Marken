# MARKEN

**The AI marketer that posts for you every morning, using your real product, your brand rules and today's trends. You approve with one tap.**

> Your real product, never redrawn.

Built for the **Meta Global AI Developer Hackathon**. Target user: small business owners, in any country, who sell physical products on Instagram. Content language is set per shop (English and Bahasa Indonesia); the interface is English.

**Built with Muse Spark Open.**

## The three pillars

1. **Real product, never redrawn.** SAM 3.1 cuts the product out of the owner's photo and the owner confirms the cutout. Muse Image paints only a background scene with a reserved empty area and is never asked to draw the product. Deterministic `sharp` code places the confirmed cutout into that area. A fidelity check then compares the product region of each slide against the cutout; only slides that pass earn the **Real product** badge and a before/after toggle.
2. **Shows up every morning.** Inngest cron jobs research trends and prepare a 3-slide carousel (hook, product, call to action) before the owner's notify time, then email a reminder. Jobs are idempotent, retried, and isolated per shop.
3. **Shows its work.** Every model call goes through one gateway that validates JSON output, logs a `model_calls` row (model, tokens, images, latency, cost, cache hit, fallback) and falls back to Muse Spark Open for text. The Agent Activity Panel on Today shows each step live.

Nothing is published without the owner's Approve (enforced by a database trigger, not only by app code), and every Instagram carousel is posted only after all three slides pass the fidelity check.

## Model routing

All calls go through `src/lib/gateway/index.ts`.

| Step | Model | Notes |
| :--- | :--- | :--- |
| Extract product details from photos | Muse Spark (`muse-spark-1.3`) | Vision, JSON output; price is `null` unless printed in the photo |
| Cut out the product | SAM 3.1 (`sam-3.1`, `@meta-sam/parser`) | Transparent PNG; owner confirms it in onboarding step 3 |
| Research trends | Muse Wonder (`muse-wonder-1.0`) | Falls back to Muse Spark web search, and the fallback is logged |
| Score trends 0-100 | Muse Spark Open (`muse-spark-1.3-contributor`) | Only candidates above the threshold are analysed |
| Analyse a trend into a scene brief | Muse Spark | Cached 7 days and shared by every shop |
| Plan the carousel, captions, rule check | Muse Spark | Style rules and tone injected into every prompt |
| Render each 1080x1350 scene | Muse Image (`muse-image-1.0`) | Reserved empty product area; never given the product |
| Place the product, verify the slide | `sharp` + Muse Spark | Pixel comparison is code; Muse Spark checks spelling and style rules |
| Regenerate a caption from feedback | Muse Spark | Max 5 per post per day |
| Text fallback when the Meta API fails | Muse Spark Open | Shown in the Activity Panel |

Target cost per finished carousel is under USD 0.10; one-time extraction and shared trend analysis are reported separately.

## Stack

Next.js (App Router) + TypeScript + Tailwind PWA on Vercel · Supabase (Auth with Google and magic link, Postgres with row level security, private Storage with signed URLs) · Inngest (cron and durable jobs) · Meta Model API · `sharp` · Instagram Graph API (carousel publishing, tokens encrypted at rest) · Resend (email reminder).

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # fill in the values; GATEWAY_MODE=mock runs the models offline
pnpm dev
```

- **Database:** apply the SQL files in `supabase/migrations/` to your Supabase project, in order. `GATEWAY_MODE=mock` lets you exercise the whole app without Meta Model API keys.
- **Jobs:** run the Inngest dev server against `http://localhost:3000/api/inngest` (`npx inngest-cli@latest dev`) to execute the crons and on-demand jobs.
- **Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Repository map

| Path | What lives there |
| :--- | :--- |
| `src/lib/gateway/` | Single model gateway, cost table, telemetry |
| `src/lib/agents/`, `src/lib/studio/` | Extraction, trends, planner, scene, composite, fidelity |
| `src/lib/jobs/` | Inngest functions: `trends.daily`, `posts.daily`, generate, regenerate, publish |
| `src/lib/supabase/` | Browser, server and admin clients, session proxy, generated types |
| `src/lib/instagram/` | OAuth, token encryption and refresh, carousel publishing |
| `src/app/api/` | API routes (uploads, extract, onboarding, post actions, activity) |
| `supabase/migrations/` | Schema, RLS policies, storage bucket |
| `docs/SRD.md` | Source of truth (SRD v2.0) |

## Pilot results

Pilot numbers are reported honestly, including skips, edits and failures. They will be added here from the pilot log when the pilot has run; none are claimed yet.

## Licence notice

Built with Muse Spark Open. Muse Spark Open is used under its own licence terms.

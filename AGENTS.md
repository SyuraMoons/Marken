# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, Antigravity, etc.) working in this repository.

## Project

**MARKEN** is the AI marketer that posts for you every morning, using your real product, your brand rules, and today's trends. You approve with one tap. Built for the **Meta Global AI Developer Hackathon** (submission due **4 Nov 2026, 9:00 PM ET / 5 Nov, 09:00 WIB**).

- **Product name:** **MARKEN**. ("TrenToko" in `docs/images/*.png` is the old name — never use it in code or UI.)
- **Target user:** Small business owners in any country who sell **physical products** on Instagram. Do not use "UMKM" or frame the product as Indonesia-only. Content language is set per shop (English and Bahasa Indonesia at the demo). UI strings are English and externalised in `src/lib/i18n/index.ts`.
- **Headline promise:** *"Your real product, never redrawn."*
- **North Star:** **Trusted posts per shop per week** (a post counts only when approved by the owner, published, and every slide passed the product fidelity check).
- **Source of truth:** `docs/SRD.md` (**SRD v2.0 Final**). If anything from v1.0/v1.1 disagrees with v2.0, **v2.0 wins**.
- **Team & Workstreams:** See `docs/TEAM.md` for workstream boundaries between **Altaf** (AI Engine, Gateway, Studio/Fidelity), **Harfi** (Supabase, Inngest Jobs, IG API, API Routes), and **Nalen & Akhnaf** (UI/UX, Frontend Flows, Pilot & Video).

- **Frontend rules:** Anyone touching UI reads `docs/frontend/` first (`RULES.md`, `DESIGN.md`, `DESIGN_FIXES.md`, `DECISIONS.md`, `API_CONTRACT.md`).

## Status and commands

Scaffold state: routes exist and render placeholders, API routes return 501, and `src/lib/*` modules are being implemented by workstream (`src/lib/gateway/*`, `src/lib/studio/cutout.ts`, and `src/lib/agents/extract.ts` are live against `https://api.meta.ai/v1`).

```bash
pnpm dev          # local dev server
pnpm build        # production build (also generates route types used by PageProps/LayoutProps)
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit; run after `pnpm build` or `pnpm dev` so route types exist
```

Copy `.env.example` to `.env.local` for secrets.

Next.js 16 notes: middleware is now `src/proxy.ts`; `cacheComponents` is on, so dynamic `params` need `generateStaticParams` or a Suspense boundary.

Stack (SRD v2.0 §9): Next.js App Router + TypeScript + Tailwind (PWA) on Vercel, Supabase (Auth with Google + magic link, Postgres with RLS, Storage with signed URLs), Inngest for cron and durable jobs, Meta Model API (`Muse Spark` / `muse-spark-1.3`, `Muse Wonder` / `muse-wonder-1.0`, `Muse Image` / `muse-image-1.0`, `SAM 3.1` / `sam-3.1` with `@meta-sam/parser`), `Muse Spark Open` (`muse-spark-1.3-contributor` on Meta API or Baseten/Modal override), `sharp` for deterministic server-side compositing & fidelity verification, Instagram Graph API (carousel), Resend for email reminders.

## Three Pillars & Architecture Invariants

Breaking any of these fails SRD v2.0 acceptance criteria:

1. **Pillar 1 — Real product, never redrawn (`F-09`, `F-26`, `F-22`):**
   - `SAM 3.1` cuts out the product at upload; the owner confirms the cutout in onboarding step 3 (`FR-SP-09`).
   - `Muse Image` generates each 1080×1350 (4:5) scene with a **reserved empty product area** and slide text (`FR-CG-04`). It **never** receives an instruction to draw the product.
   - Deterministic server-side code (`sharp`) composites the confirmed product cutout into the reserved area (scale, shadow). Product pixels are **never** passed back through a generative model (`FR-CG-09`).
   - **Fidelity check (`FR-FD-01..03`):** Code compares the product region of each slide against the cutout within tolerance, and `Muse Spark` verifies slide text spelling and style rules. Passing posts show the **"Real product" badge** and a **before/after toggle** on Today.
2. **Pillar 2 — Shows up every morning (`NFR-15`):**
   - Agent loop runs in Inngest jobs, not request handlers. Cron `trends.daily` researches trends (`Muse Wonder`, fallback `Muse Spark` web search), scores them 0–100 (`Muse Spark Open`), and analyses top trends (`Muse Spark`). Cron `posts.daily` plans a 3-slide carousel (`hook`, `product`, `call to action`), renders visuals, runs the fidelity check, and emails the owner.
   - Jobs must be idempotent and isolate failures per shop.
3. **Pillar 3 — Shows its work (`FR-CL-01`, `FR-AP-01`, `NFR-06`):**
   - **Single model gateway (`src/lib/gateway/index.ts`):** Every call to any model (`Muse Spark`, `Muse Wonder`, `Muse Spark Open`, `Muse Image`, `SAM 3.1`) goes through one gateway. It validates JSON output against a schema (retries once, then fails visibly), logs a `model_calls` row (`shop_id`, `post_id`, `step`, `model`, `tokens`, `images`, `latency_ms`, `cost_usd`, `cache_hit`, `fallback`), and falls back to `Muse Spark Open` for text when Meta Model API fails (`NFR-18`).
   - **Agent Activity Panel (`F-24`):** Live view on Today listing each step for a post with model, status, latency, cost (target `< USD 0.10` per finished carousel), cache hit, and fidelity check result.
4. **Approve Gate (`FR-TD-02`):**
   - Post status flows `generating → ready → approved → publishing → published | failed`, or `→ skipped`. Only `approved` may move to `publishing`. Nothing publishes without Approve.
5. **Shared 7-Day Trend Cache (`FR-TR-04`):**
   - `trend_analyses` are cached for 7 days across all shops. A second shop using the same trend triggers zero new analysis calls.
6. **Style Rules & Truth Guardrails (`FR-SP-02`, `FR-SP-04..06`):**
   - Prices are `null` when not visible in product photos (never invent prices or claims).
   - Shop tone, style rules (up to 10), and content language are injected into every prompt, and captions/slide text pass a rule check (regenerate once on fail, then flag).
7. **Security & Mobile-First PWA (`NFR-01..14`):**
   - Secrets and Instagram tokens stay server-side; IG tokens encrypted at rest. RLS scopes all data to the owner's single shop (`one shop per owner`). Media served only via signed URLs.
   - Works from 360 px wide; Today loads in `< 2 s`.

## Routes and User Flow (SRD v2.0 §6 & §9)

- **Flow:** Landing `/` → `/login` → `/onboarding/[step]` (**5 steps**, saved server-side per step) → `/today`. Logged-in users hitting `/` are redirected server-side (`FR-LP-03`).
- **5 Onboarding Steps:**
  1. Shop basics (required): name, category, country, content language, time zone.
  2. Upload products (required): 3–10 photos (`SAM 3.1` cutout + `Muse Spark` extraction).
  3. Review (required): edit/delete/add products; owner confirms each cutout.
  4. Voice & Instagram (optional): tone, rules, live sample caption; connect IG or skip.
  5. First post + tour (optional tour): coach marks run on a sample post while the real 3-slide carousel generates, swapping to the real post when ready.
- **Routes:** `/` · `/login` · `/onboarding/[step]` · `/today` · `/posts/[id]/edit` · `/products` · `/results` (P1) · `/settings`
- **API:** `POST /api/uploads` · `POST /api/shops/:id/extract` · `PATCH /api/shops/:id/onboarding` · `POST /api/shops/:id/posts/generate` · `POST /api/posts/:id/approve` · `POST /api/posts/:id/skip` · `POST /api/posts/:id/regenerate` · `GET /api/posts/:id/activity` · `GET /api/auth/instagram/callback` · cron `trends.daily` · cron `posts.daily`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

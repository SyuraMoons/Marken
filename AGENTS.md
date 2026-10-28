# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repository.

## Project

**MARKEN** is an AI marketing team for small business owners, built for the Meta Global AI Developer Hackathon (submission due 4 Nov 2026, 9:00 PM ET). Every day it finds trends, turns one into a ready-to-post Instagram post for the owner's product, and publishes it once the owner taps Approve.

- The product name is **MARKEN**. "TrenToko" in `docs/images/*.png` is the old name — never use it in code or UI.
- The target user is **small business owners in any country**. Do not use "UMKM" or frame the product as Indonesia-only. Content language is set per shop (English and Bahasa Indonesia at the demo). UI strings are English and externalised.
- `docs/SRD.md` is the source of truth for requirements. IDs: `F-xx` features, `FR-<area>-xx` functional requirements, `NFR-xx` non-functional requirements. P0 must be in the demo; P1 is built only after the end-to-end gate (2 Nov). P2 (mentor dashboard, TikTok/Shopee publishing, influencer matching) is cut.

## Status and commands

Placeholder scaffold only: every route from SRD §7.3 exists but renders a placeholder, API routes return 501, and `src/lib/*` modules are stubs. Supabase, Inngest and model SDKs are not installed yet, and `supabase/migrations/` is empty.

```bash
pnpm dev          # local dev server
pnpm build        # production build (also generates route types used by PageProps/LayoutProps)
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit; run after `pnpm build` or `pnpm dev` so route types exist
```

No test runner yet (Vitest is planned). Copy `.env.example` to `.env.local` for secrets.

Next.js 16 notes: middleware is now `src/proxy.ts`; `cacheComponents` is on, so dynamic `params` need `generateStaticParams` or a Suspense boundary.

Planned stack (SRD §7.1): Next.js App Router + TypeScript + Tailwind (PWA), Supabase (Auth, Postgres with RLS, Storage with signed URLs), Inngest for cron and durable jobs, Meta Model API (Muse Spark, Muse Image, SAM 3.1), Llama on Baseten/Modal, Instagram Graph API, Web Push (VAPID) + Resend, hosted on Vercel.

## Architecture invariants

These hold across the codebase. Breaking any of them fails SRD acceptance criteria:

- **Single model gateway.** Every call to any model (Meta Model API or Llama) goes through one gateway module. It routes the step to a model, validates JSON output against a schema (retries once, then fails the step visibly), logs a `model_calls` row (shop, post, step, model, tokens, images, latency, USD cost), and falls back to Llama for text when Meta fails. No direct SDK/fetch calls to model providers elsewhere (FR-CL-01, NFR-16, NFR-18).
- **Approve gate.** Post status flows `generating → ready → approved → publishing → published | failed`, or `→ skipped`. Only `approved` may move to `publishing`. No code path publishes anything else (FR-TD-02).
- **Agent loop runs in jobs, not requests.** Cron `trends.daily` collects trends, ranks them and analyses the top ones. `posts.daily` plans one post per shop, renders it and notifies the owner. On-demand jobs: extract, regenerate, publish, notify. Jobs must be idempotent (a re-run creates no duplicate posts), and one shop's failure must not block another (NFR-15).
- **Trend analyses are shared.** They are cached for 7 days across all shops. A second shop using the same trend must trigger zero new analysis calls (FR-TR-04).
- **Style rules everywhere.** The shop's tone, rules and content language are injected into every generation prompt. Every caption passes a rule check before it is shown (FR-SP-05/06).
- **Security.** Secrets and Instagram tokens stay server-side, and the tokens are encrypted at rest. RLS scopes all data to shops the owner owns. Media is served only via signed URLs (NFR-12/13).
- **Mobile-first PWA.** Layouts must work from 360 px wide. Initial JS stays under 200 KB gzipped per route. Today loads in under 2 s, and the landing page's LCP is under 2.5 s.

## Routes and data

Route list, API endpoints and table definitions are in SRD §7.2–7.3. The user flow is Landing `/` → `/login` → `/onboarding/[step]` (8 steps, progress saved server-side) → `/today`. Logged-in users hitting `/` are redirected server-side.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

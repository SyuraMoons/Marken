# MARKEN — Team Workstreams & Ownership (SRD v2.0)

Built for the **Meta Global AI Developer Hackathon** (Deadline: **4 Nov 2026, 9:00 PM ET / 5 Nov, 09:00 WIB**).
**End-to-End Gate:** Monday, **2 Nov 2026 evening**.

---

## 1. Workstream Ownership

Everyone can work fullstack when needed, but to move fast and avoid Git merge conflicts before the **2 Nov Gate**, module ownership is split as follows:

| Team Member(s) | Workstream | Core Responsibilities (SRD v2.0) | Primary Directories / Files |
| :--- | :--- | :--- | :--- |
| **Altaf** | **AI Engine, Model Gateway & Fidelity Pipeline** | • **Single Model Gateway (`FR-CL-01`)**: Meta Model API (`Muse Spark`, `Muse Wonder`, `Muse Image`, `SAM 3.1`) + `Muse Spark Open` (Baseten/Modal) + JSON schema validation + cost/latency tracking.<br>• **Product Studio & Pillar 1 (`F-09`, `F-26`, `F-22`)**: `SAM 3.1` cutout → `Muse Image` 1080×1350 scene with reserved empty area → deterministic `sharp` pixel compositing → **Fidelity Check** (`FR-FD-01..03`).<br>• **Agent Prompts & Logic**: Product extraction (`F-04`), Trend research/scoring/7-day analysis (`F-06`, `F-16`, `F-07`), 3-slide carousel planner (`F-08`), Style rule checker (`F-05`), Caption edits (`F-11`). | • `src/lib/gateway/**`<br>• `src/lib/studio/**` (cutout, compositing, fidelity)<br>• `src/lib/agents/**` (prompts, extraction, trends, planner) |
| **Harfi** | **Backend, Database, Durable Jobs & Integrations** | • **Supabase (`F-02`, `NFR-12..14`)**: Postgres v2.0 migrations (`supabase/migrations/`), RLS per shop, Auth (Google OAuth + Magic Link), Storage with signed URLs (`media_uploads`).<br>• **Inngest Durable Jobs (`NFR-15`, `F-24`)**: Cron (`trends.daily`, `posts.daily`) + on-demand jobs (`extract`, `generate`, `regenerate`, `publish`, `notify`), emitting step events for the Activity Panel (`FR-AP-01`).<br>• **Integrations & API Routes**: Instagram Graph API carousel publisher + token encryption/refresh (`F-12`, `FR-PB-01..05`), Resend email reminder (`F-13`), wiring `src/app/api/**` routes. | • `supabase/migrations/**`<br>• `src/lib/supabase/**`<br>• `src/lib/jobs/**`<br>• `src/lib/instagram/**`<br>• `src/lib/notify/**`<br>• `src/app/api/**`<br>• `src/proxy.ts` |
| **Nalen & Akhnaf (Anap)** | **Product UI/UX, Frontend Flows, Pilot & Demo Video** *(Shared Pool)* | • **Design & Landing (`F-01`)**: Figma UI system, mobile-first 360px PWA layout, Landing page `/` (`FR-LP-01`: headline *"Your real product, never redrawn"*, 3-step how it works, sample before/after carousel).<br>• **Auth & 5-Step Onboarding (`F-02`, `F-03`)**: `/login`, `/onboarding/[1..5]` (1. Shop basics, 2. Upload 3–10 photos, 3. Review & confirm cutouts, 4. Voice & IG, 5. First post + coach-mark tour on sample post).<br>• **Main App Screens (`F-10`, `F-24`, `F-26`, `F-15`)**: `/today` (swipeable 3-slide carousel, Approve/Edit/Skip, **"Real product" badge + before/after toggle**, live **Agent Activity Panel**), `/posts/[id]/edit`, `/products`, `/settings`, `/results` (P1).<br>• **Pilot & Demo Video (55% of Judging Score)**: Recruit 3–4 real physical product sellers, run manual pilot (30 Oct–2 Nov) + in-app pilot (3 Nov), log `EV-01..04` evidence, produce `< 3:00` demo video. | • `src/app/(app)/**`<br>• `src/app/onboarding/**`<br>• `src/app/login/**`<br>• `src/app/page.tsx`<br>• `src/components/**`<br>• `src/lib/i18n/**` |

---

## 2. Interface Contracts Between Altaf & Harfi

To ensure **Altaf's AI modules** plug cleanly into **Harfi's Inngest jobs & API routes**:

1. **Model Gateway (`src/lib/gateway/index.ts`)**:
   - Altaf exposes `callModel(call)` which returns structured output + telemetry (`model`, `tokensIn`, `tokensOut`, `images`, `latencyMs`, `costUsd`, `cacheHit`, `fallback`).
   - Harfi's DB logger / Inngest steps persist rows to `model_calls` and surface them via `GET /api/posts/:id/activity`.
2. **Agent Step Functions (`src/lib/agents/` & `src/lib/studio/`)**:
   - Altaf builds pure/service functions for each pipeline step:
     1. `extractProductsAndCutouts(photos)` → `Muse Spark` JSON + `SAM 3.1` cutout PNG buffer.
     2. `researchAndScoreTrends(country, category)` → `Muse Wonder` (fallback `Muse Spark` search) + `Muse Spark Open` 0–100 score.
     3. `analyseTrend(trend)` → `Muse Spark` scene brief (cached 7 days by Harfi in `trend_analyses`).
     4. `planDailyCarousel(shop, products, trendAnalysis)` → `Muse Spark` 3-slide plan + 2 captions + hashtags + style rule check.
     5. `renderAndVerifySlide(sceneBrief, cutoutBuffer)` → `Muse Image` scene (1080×1350 with reserved area) + `sharp` composite + fidelity check (`fidelity_score`, `fidelity_passed`).
   - Harfi orchestrates these functions inside Inngest (`trends.daily`, `posts.daily`, `POST /api/shops/:id/extract`, `POST /api/shops/:id/posts/generate`) and handles Supabase Storage signed URLs.

---

## 3. Schedule & Gate Checklist (SRD v2.0 §10)

| Date | Engineering (Altaf, Harfi, Nalen, Akhnaf) | Pilot & Evidence |
| :--- | :--- | :--- |
| **Thu 29 – Fri 30 Oct** | • **Altaf**: Gateway + smoke test `SAM 3.1` cutout, `Muse Image` scene, `Muse Wonder`, `Muse Spark` extraction, `sharp` compositing & fidelity check.<br>• **Harfi**: Supabase v2.0 schema + RLS + Storage + Auth.<br>• **Nalen & Akhnaf**: Landing `/`, `/login`, Onboarding steps 1–3 UI. | Recruit 4 sellers (keep 3); record baseline (`EV-01`); start manual pilot. |
| **Sat 31 Oct** | • **Altaf**: Trend research (`Muse Wonder`), scoring (`Muse Spark Open`), analysis prompt (`Muse Spark`).<br>• **Harfi**: `trends.daily` Inngest cron + 7-day `trend_analyses` cache.<br>• **Nalen & Akhnaf**: Onboarding steps 4–5 + tour + cutout confirmation UI. | Manual pilot posts logged (`EV-02`). |
| **Sun 1 Nov** | • **Altaf**: 3-slide daily planner + Product Studio (`SAM 3.1` + `Muse Image` + `sharp` composite) + Fidelity check (`FR-FD-01..03`).<br>• **Harfi**: `posts.daily` job + upload/extract/generate API routes.<br>• **Nalen & Akhnaf**: `/today` carousel, before/after toggle, `/products`. | Manual pilot posts logged (`EV-02`). |
| **Mon 2 Nov (GATE)** | • **All**: `/today` Approve/Edit/Skip, IG Graph API publish ( + download/copy fallback), Resend email, live Agent Activity Panel.<br>• **Evening Gate**: Full loop works end-to-end (`upload → trend → carousel → fidelity check → approve → Instagram`). | Manual pilot posts logged (`EV-02`). |
| **Tue 3 Nov** | Bug fixes only; P1 features (`F-17` Results, `F-18` Weekly learning, `F-11b` Slide regen) only if Gate passed. | In-app pilot with real sellers (target: **≥12 trusted posts across ≥3 shops**); record demo footage. |
| **Wed 4 Nov** | Video editing (`< 3:00`), README with model routing & honest pilot numbers (`DM-03`), seeded judge account (`DM-04`), submit by **9:00 PM ET**. | Finalize pilot table (`EV-03`). |

> **Cut Order if Short on Time Before Gate:**
> 1. `F-13` Email reminder → 2. `F-15` Settings (keep replay tour) → 3. `F-11` Edit caption. **Never cut `F-26` (Fidelity check & "Real product" badge).**


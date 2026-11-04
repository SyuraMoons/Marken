# MARKEN

**Turn product photos into social posts every morning.** MARKEN is an autonomous AI marketer that makes a daily three-slide Instagram carousel from your real product, your brand rules and today's trends. You approve it with one tap.

Most small business owners who sell physical products on Instagram spend 45 to 60 minutes every morning on content: checking trends, brainstorming hooks, editing photos and writing captions. Generic AI image tools save time but redraw the product. Logos warp, labels blur, packaging changes shape, and customers stop trusting the photos. MARKEN keeps the product out of the generative model entirely: *"Your real product, never redrawn."*

MARKEN is a mobile-first web app (PWA) with an autonomous agent pipeline behind it. The owner finishes a five-step setup, confirms a clean cutout of each product and, optionally, connects Instagram. After that, background jobs run every day without being prompted. Muse Wonder finds rising trends, Muse Spark Open scores them, Muse Spark writes a three-slide story, Muse Image paints a background scene with an empty space for the product, and `sharp` code places the confirmed cutout into that space. A fidelity check compares the product pixels on every slide with the original before the owner sees anything. The owner then gets an email, opens the post from History, toggles before/after, watches the Agent Activity Panel and approves.

It is built for small business owners who sell physical products, by four students from Universitas Gadjah Mada.

> Meta Global AI Developer Hackathon · Track: Indie Developer · Problem statement: Build for Your World · Entered for bonus prizes: Best Agentic Use Case, Best Creative Build.

> **License and model attribution.** [PolyForm Noncommercial 1.0.0](LICENSE): free for personal, research, educational and other noncommercial use; commercial use needs our written permission ([open an issue](https://github.com/SyuraMoons/Marken/issues)). Built with Muse Spark Open. Meta models are not covered by this license; their use is subject to the Meta Model API terms and the applicable Meta open model licenses. Details in [NOTICE.md](NOTICE.md); requirements in [docs/SRD.md](docs/SRD.md).

## The three pillars

1. **Real product, never redrawn.** SAM 3.1 cuts the product out of the owner's photo and the owner confirms the cutout. Muse Image only paints the background and is never asked to draw the product. Deterministic `sharp` code places the cutout, and a pixel check on every slide must pass before the post can be approved.
2. **Shows up every morning.** Inngest cron jobs research trends and prepare the carousel before the owner's notify time, then send an email. Jobs are idempotent, retried and isolated per shop.
3. **Shows its work.** Every model call goes through one gateway that validates the output, logs model, tokens, latency, cost, cache hit and fallback, and falls back to Muse Spark Open for text. The Agent Activity Panel shows each step on the post. The target cost is under USD 0.10 per finished carousel.

**Guardrails.** Nothing is published without the owner's Approve, and a database trigger enforces this, not only app code. Prices stay empty unless they are visible in the photo, so the model never invents prices or claims. The shop's tone and up to 10 style rules are injected into every prompt, and every caption and slide text is checked against them.

## Live

| | |
| :--- | :--- |
| **App (PWA)** | [marken-olive.vercel.app](https://marken-olive.vercel.app) |
| **Sandbox, no sign-in** | [marken-olive.vercel.app/sandbox](https://marken-olive.vercel.app/sandbox) |
| **Public before/after example** | [marken-olive.vercel.app/example](https://marken-olive.vercel.app/example) |
| **Three-minute demo video** |[youtube.com/YjrocdaNMdg](https://youtu.be/YjrocdaNMdg) |
| **Architecture diagrams** | [AI pipeline](docs/images/ai-pipeline-flow.png) · [Single model gateway](docs/images/ai-gateway-flow.png) |

## Built during the hackathon

MARKEN is new work. It is not built on an existing product or codebase. The repository started empty on 27 Oct 2026 (the first commit adds a one-line README), and every feature, screen, agent, job, migration and test here was written by our team during the event. The full [commit history](https://github.com/SyuraMoons/Marken/commits/development) and the [merged pull requests](https://github.com/SyuraMoons/Marken/pulls?q=is%3Apr+is%3Amerged) show when each part was added.

| We built | We did not build (used as is) |
| :--- | :--- |
| The product idea, design and every screen | Next.js, React, Tailwind and the other npm packages |
| The agent pipeline: extraction, trends, planner, captions and rule checks ([`src/lib/agents/`](src/lib/agents/)) | The Meta models: Muse Spark, Muse Spark Open, Muse Wonder, Muse Image and SAM 3.1 |
| The single model gateway with fallback and cost logging ([`src/lib/gateway/`](src/lib/gateway/)) | `@meta-sam/parser` for reading SAM output |
| The studio: mask cleanup, compositing, templates and fidelity check ([`src/lib/studio/`](src/lib/studio/)) | `sharp` for image processing |
| Durable jobs, publishing and token refresh ([`src/lib/jobs/`](src/lib/jobs/)) | Supabase, Inngest, Vercel, Resend and the Instagram Graph API |
| Database schema, row level security and triggers ([`supabase/migrations/`](supabase/migrations/)) | The fonts in `src/lib/studio/fonts/` (Google Fonts) |
| The tests ([`tests/`](tests/)) | |

## Try it (for judges)

**Option 1: Sandbox, under a minute, no setup.** Open [/sandbox](https://marken-olive.vercel.app/sandbox). It needs no sign-in, no card and no API keys, and runs on fixed sample data. Pick a product, review the carousel and share it. Press **Practise an error and retry** to see how a failed step is shown and retried.

**Option 2: Live walkthrough with a real shop.**

1. Open [marken-olive.vercel.app](https://marken-olive.vercel.app) and sign in with Google or an email link.
2. **Step 1:** enter shop basics (name, category, country, content language, time zone).
3. **Step 2:** upload product photos. Muse Spark reads the product details and SAM 3.1 cuts out the product.
4. **Step 3:** review each product and confirm its cutout.
5. **Step 4:** set the tone and style rules, and connect Instagram or skip it.
6. **Step 5:** the first carousel is generated while a short tour runs on a sample post.
7. Open the post from **History**. Check the **Real product** badge, toggle before/after, watch the Agent Activity Panel, then Approve. Without Instagram connected, Approve gives you download and copy-caption instead.

## Who it is for

**Packaged food and coffee**, **handmade apparel and fashion**, and **botanical beauty and cosmetics** sellers: anyone whose sales depend on customers recognising the real product.

| | Manual daily posting | Generic AI image tools | MARKEN |
| :--- | :--- | :--- | :--- |
| Time each morning | 45 to 60 minutes | Prompting, then fixing what the model got wrong | One review and one tap |
| Product accuracy | Real | Redrawn; logos and labels drift | Real pixels, checked on every slide |
| Trends | Checked by hand | None unless prompted | Researched and scored daily |
| Brand rules | In the owner's head | Repeated in every prompt | Stored once, checked every post |
| Shows up without being asked | No | No | Yes, a daily background job |

### Why not roll your own

| You would have to build | Here |
| :--- | :--- |
| Parsing segmentation output into a usable mask | [`src/lib/gateway/providers/sam-output.ts`](src/lib/gateway/providers/sam-output.ts) |
| Cleaning masks (speckles, holes, colour fringes) and rejecting bad cutouts | [`src/lib/studio/mask-refine.ts`](src/lib/studio/mask-refine.ts) · [`src/lib/studio/cutout-quality.ts`](src/lib/studio/cutout-quality.ts) |
| Placing the product without a model touching it | [`src/lib/studio/composite.ts`](src/lib/studio/composite.ts) |
| Proving the product was not changed | [`src/lib/studio/fidelity.ts`](src/lib/studio/fidelity.ts) |
| Routing models with fallback, schema checks and cost logging | [`src/lib/gateway/index.ts`](src/lib/gateway/index.ts) · [`src/lib/gateway/cost.ts`](src/lib/gateway/cost.ts) |
| Durable, retried jobs that never double-post | [`src/lib/jobs/`](src/lib/jobs/) |

## How it works

```
 Shop owner (phone)
      │  photos, approvals
      ▼
 ┌──────────────────────┐      ┌─────────────────────────────┐
 │  Next.js PWA         │─────▶│  Supabase                   │
 │  History · Products  │      │  Postgres + RLS · Storage   │
 │  Create · Analytics  │      │  (private, signed URLs)     │
 └─────────┬────────────┘      └──────────────▲──────────────┘
           │ events                           │ rows, slides
           ▼                                  │
 ┌──────────────────────┐      ┌──────────────┴──────────────┐
 │  Inngest jobs        │─────▶│  Single model gateway       │
 │  trends.daily (cron) │      │  schema check · fallback ·  │
 │  posts.daily  (cron) │      │  model_calls telemetry      │
 │  generate · publish  │      └──────────────┬──────────────┘
 └─────────┬────────────┘                     ▼
           │                   ┌─────────────────────────────┐
           │                   │  Meta models                │
           │                   │  Muse Wonder · Muse Spark · │
           │                   │  Spark Open · Muse Image ·  │
           │                   │  SAM 3.1                    │
           ▼                   └─────────────────────────────┘
 ┌──────────────────────┐      ┌─────────────────────────────┐
 │  sharp studio        │─────▶│  Instagram Graph API        │
 │  composite · verify  │      │  (after Approve only)       │
 └──────────────────────┘      └─────────────────────────────┘
```

1. **Setup and cutout.** Muse Spark reads the product details from the photo and SAM 3.1 cuts out the product. The mask is cleaned and checked, and the owner confirms it.
2. **Daily trends.** Muse Wonder researches trends (falling back to Muse Spark web search), Muse Spark Open scores each one 0 to 100, and Muse Spark analyses the best. Analyses are cached for 7 days and shared across shops.
3. **Carousel plan.** Muse Spark writes the hook, product and call-to-action slides plus caption options, with the shop's tone and rules in the prompt.
4. **Scene.** Muse Image paints each 1080×1350 scene with an empty area reserved for the product.
5. **Compositing.** `sharp` places the confirmed cutout into that area with framing and shadow. No model sees the product pixels again.
6. **Check and publish.** Code compares the product region with the cutout, and Muse Spark checks spelling and style rules. The owner is emailed, reviews and approves; only then is the carousel published to Instagram.

## Where it is in the code

| Claim | Code | Test |
| :--- | :--- | :--- |
| Every model call goes through one gateway | [`src/lib/gateway/index.ts`](src/lib/gateway/index.ts) | |
| Mask cleanup removes speckles and fills small holes | [`src/lib/studio/mask-refine.ts`](src/lib/studio/mask-refine.ts) | [`tests/cutout.test.ts`](tests/cutout.test.ts) |
| Bad cutouts are rejected, real products pass | [`src/lib/studio/cutout-quality.ts`](src/lib/studio/cutout-quality.ts) | [`tests/cutout.test.ts`](tests/cutout.test.ts) |
| Background colour is removed from cutout edges | [`src/lib/studio/mask-refine.ts`](src/lib/studio/mask-refine.ts) | [`tests/cutout.test.ts`](tests/cutout.test.ts) |
| Product pixels are verified on every slide | [`src/lib/studio/fidelity.ts`](src/lib/studio/fidelity.ts) | [`tests/integration.test.mjs`](tests/integration.test.mjs) |
| Missing product pixels fail before rendering | [`src/lib/jobs/ports.ts`](src/lib/jobs/ports.ts) | [`tests/integration.test.mjs`](tests/integration.test.mjs) |
| A storage outage is reported as an outage, not a bad photo | [`src/lib/jobs/ports.ts`](src/lib/jobs/ports.ts) | [`tests/integration.test.mjs`](tests/integration.test.mjs) |
| A studio failure never becomes a blank "verified" slide | [`src/lib/studio/index.ts`](src/lib/studio/index.ts) | [`tests/integration.test.mjs`](tests/integration.test.mjs) |
| Slide text and template graphics survive editing | [`src/lib/studio/templates.ts`](src/lib/studio/templates.ts) | [`tests/cutout.test.ts`](tests/cutout.test.ts) |
| Nothing publishes without Approve | [`supabase/migrations/20261101031415_core_schema.sql`](supabase/migrations/20261101031415_core_schema.sql) (`enforce_post_status`) | |
| At most 5 live posts per shop per day | [`supabase/migrations/20261103030000_five_posts_per_day.sql`](supabase/migrations/20261103030000_five_posts_per_day.sql) | |
| Publishing never posts the same carousel twice | [`src/lib/jobs/publish.ts`](src/lib/jobs/publish.ts) | |
| Native sharing keeps the original image bytes and order | [`src/lib/sharing/native.ts`](src/lib/sharing/native.ts) | [`tests/integration.test.mjs`](tests/integration.test.mjs) |
| Dashboard, setup and OAuth routes stay protected | [`src/lib/supabase/proxy.ts`](src/lib/supabase/proxy.ts) | [`tests/integration.test.mjs`](tests/integration.test.mjs) |
| Instagram tokens are encrypted at rest | [`src/lib/instagram/crypto.ts`](src/lib/instagram/crypto.ts) | |

## What uses Meta AI

| Model | Role | Why this model |
| :--- | :--- | :--- |
| **SAM 3.1** | Cuts the product out of the owner's photo | Zero-shot segmentation that works on any product without training |
| **Muse Spark** | Reads product details, plans the carousel, writes captions, checks rules and slide text | Vision plus structured JSON output in one model |
| **Muse Wonder** | Researches trends on the web | Agentic browsing for what is rising today |
| **Muse Spark Open** | Scores trend candidates 0 to 100; text fallback when the Meta API fails | Cheap scoring at volume and an independent fallback |
| **Muse Image** | Paints the 1080×1350 scene with a reserved product area | Photorealistic backgrounds that leave room for the real product |
| **Muse Code** | Used while building: scaffolding, validation schemas and test recipes | Faster, safer development; not part of the runtime pipeline |

## For the bounties

**Best Agentic Use Case.** The agent runs on its own every day without a prompt. Trend research, scoring, planning, rendering, verification and the email all run as durable Inngest jobs ([`src/lib/jobs/`](src/lib/jobs/)). Every step is logged and shown in the Agent Activity Panel.

**Best Creative Build.** Muse Image builds a new world around the product every day, and deterministic templates, extracted brand colours and the shop's brand kit keep it on-brand ([`src/lib/studio/templates.ts`](src/lib/studio/templates.ts), [`src/lib/studio/palette.ts`](src/lib/studio/palette.ts)). The product itself is never redrawn.

## What you have to trust

| | |
| :--- | :--- |
| **Your media** | Stored in a private Supabase bucket and served only through short-lived signed URLs. |
| **Your Instagram account** | OAuth tokens are encrypted at rest with AES-256-GCM and never sent to the browser. |
| **Your data** | Row level security scopes every table to the owner's active shop. |
| **The "Real product" badge** | Set by a pixel comparison in code, not by a model's opinion. |
| **Outside our control** | Meta model availability and the Instagram Graph API. |

## What comes next

- Several products arranged in one slide.
- Publishing directly to Facebook Pages.
- A 24-hour engagement loop that feeds results back into the next day's plan.
- A weekly brand memory summary built from what worked.

## What is real

| | Status |
| :--- | :--- |
| Setup with product extraction and SAM 3.1 cutout | **Live** |
| Daily trend research and scoring | **Live** |
| Three-slide carousel generation with fidelity check | **Live** |
| Approve gate in the database | **Live** |
| History, post calendar, products, create flow, brand kit | **Live** |
| Analytics and native sharing | **Live** |
| Instagram carousel publishing | **Live**, needs a connected Instagram account |
| Email reminder | **Live**, needs Resend keys |
| Sandbox and public example | **Live** |
| Automated tests | 21 tests in [`tests/`](tests/) |

## Run it locally

Prerequisites: Node 20+, pnpm 11 and a Supabase project.

```bash
git clone https://github.com/SyuraMoons/Marken.git
cd Marken
pnpm install
cp .env.example .env.local    # fill in the values; GATEWAY_MODE=mock runs the models offline
# apply supabase/migrations/*.sql to your Supabase project, in order
pnpm dev                      # http://localhost:3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest   # in a second terminal; set INNGEST_DEV=1
```

Checks:

```bash
pnpm lint
pnpm build           # also generates the route types typecheck needs
pnpm typecheck
pnpm test:unit
pnpm test:integration
```

## Repository layout

| Path | What |
| :--- | :--- |
| `src/app/` | Pages (landing, login, onboarding, History, products, create, analytics, settings) and API routes |
| `src/components/` | UI components |
| `src/lib/gateway/` | Single model gateway, providers, cost table, telemetry |
| `src/lib/agents/` | Extraction, trends, carousel planner, captions, rule checks |
| `src/lib/studio/` | Cutout, mask cleanup, scene, compositing, templates, fidelity |
| `src/lib/jobs/` | Inngest functions: trends, daily posts, generate, regenerate, publish, token refresh |
| `src/lib/supabase/` | Browser, server and admin clients, session proxy, generated types |
| `src/lib/instagram/` | OAuth, token encryption and refresh, carousel publishing |
| `supabase/migrations/` | Schema, row level security, storage bucket, triggers |
| `tests/` | Unit and integration tests |

## Docs

- [Software Requirements Specification](docs/SRD.md): the source of truth.
- [AI pipeline and single model gateway](docs/AI_PIPELINE.md)
- [Team workstreams](docs/TEAM.md)
- [Frontend design decisions and contracts](docs/frontend/)
- [Guidance for coding agents](AGENTS.md)

## Team

Four students from Universitas Gadjah Mada (UGM) in Yogyakarta, Indonesia:

- Muhamad Harfi Ibadurahman
- Altaf Parves Shua Ilham
- Nalen Raditya Sadewa
- Akhnaf Fawzan Yogatrisna

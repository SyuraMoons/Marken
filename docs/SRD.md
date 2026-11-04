# Marken SRD v2.0 (Final)

Oct 29, 2026 · @Altaf Parves

Marken is the AI marketer that posts for you every morning, using your real product, your brand rules and today's trends. You approve with one tap.

---

## 0. Key takeaways

> **Objective:** a top 5 finish in the Indie Developer track of the Meta Global AI Developer Hackathon, plus at least one bonus prize. Submission closes **4 Nov 2026, 9:00 PM ET (5 Nov, 09:00 WIB)**.

> **North Star: trusted posts per shop per week.** A post counts only when the owner approved it, it was published, and the real product was verified unchanged.

| Item | Final decision |
| :--- | :--- |
| Who we serve | Owners who sell **physical products** and market them on Instagram |
| Headline promise | **Your real product, never redrawn** |
| Output | A **3 slide carousel (4:5)**, every slide uses the verified product |
| Hackathon targets | 12 or more trusted posts across 3 or more real shops by 3 Nov |
| The gate | The full loop works end to end on **2 Nov** |

### Three pillars (every demo scene shows at least one)

| Pillar | What it means |
| :--- | :--- |
| 1. Real product, never redrawn | SAM 3.1 cuts the product, Muse Image builds only the scene, code places the original pixels and verifies them |
| 2. Shows up every morning | A daily agent loop prepares a post without any prompt |
| 3. Shows its work | The activity panel shows every step, model, cost and source |

**Guardrails (never break):** nothing publishes without Approve · the product is never redrawn · no invented prices or claims · style rules always pass · results are reported honestly.

---

## 1. Document control

v2.0 is the final SRD. It keeps the execution plan from Nalen's v1.1 and fixes its direction. Requirement IDs are kept from v1.1 so versions can be compared; a gap in numbering is a dropped requirement.

Markers: **NEW** added in v2.0 · **CHG** changed from v1.1 · **KEPT** from v1.1, unchanged.

### Kept from v1.1

| Item | Why we keep it |
| :--- | :--- |
| Muse Spark Open replaces Llama | Whole stack on Meta models; open weight bonus |
| Agent activity panel | Pillar 3; makes technical depth visible |
| Carousel output | Trends are formats; a carousel follows them. Cost is trivial at USD 0.01 per image |
| 5 step onboarding, cut list, email only reminder | Realistic scope |
| Pilot from 30 Oct, evidence rules, scripted demo video | Impact and demo are 55% of the score |

### Changed in v2.0

| Area | v1.1 | v2.0 | Why |
| :--- | :--- | :--- | :--- |
| Target user | Any small company incl. SaaS and services | Physical product sellers | Pillar 1 needs a product to protect |
| Positioning | Production arm of Meta AI insights | **Real product, never redrawn**; the Meta AI line stays as a secondary message | A clear, provable difference |
| North Star | None | Trusted posts per shop per week | One number the whole team steers by |
| Slide composition | Muse Image composes the slide with the cutout | Muse Image makes the scene only; code places the original product pixels; verified | Muse Image could alter the product |
| Muse Wonder | Watches trend videos, extracts offerings | **Trend research agent** that browses trend sources | Muse Wonder is a coding, agent and computer use model |
| Trend video analysis | Muse Wonder | Muse Spark | Multimodal model, cheaper |
| Carousel length | 3 to 5 slides | 3 slides | Hook, product, call to action |
| Cost target | USD 0.15 | USD 0.10 | Muse Image costs USD 0.01 per image |
| Trend scoring | P1 | P0 | Needed to really use Muse Spark Open |

**Cut in v2.0:** Offerings pipeline (F-21 and its FRs), LinkedIn and X export pack (F-23), peer watch (F-25), video Reel (F-20), website fetch.

---

## 2. Introduction

**Purpose.** This SRD tells the build team exactly what Marken must do by the submission deadline. Each requirement has an ID, a priority and a testable acceptance criterion. P0 must be in the demo; P1 starts only after the 2 Nov gate.

**Product in one line.** Marken is the AI marketer that posts for you every morning, using your real product, your brand rules and today's trends. You approve with one tap.

**Secondary message for Meta judges.** Meta AI already tells a business how its Instagram performs. Marken is the production arm that closes the loop: trend → content → approval → publish → measure.

**In scope:** a mobile first, installable web app (PWA): landing page, login, 5 step onboarding, and the main app (Today, Products, Results, Settings). Behind it runs the daily agent loop.

**Out of scope:** SaaS and service businesses · video and Reels · LinkedIn, X, TikTok, Shopee or Facebook publishing · chat app interfaces · payments · paid ads · multiple shops per owner · peer watch · training our own models.

| Term | Meaning |
| :--- | :--- |
| Owner | The person who runs the business and uses Marken |
| Shop | One business profile: products, tone, style rules, content language, Instagram account. One per owner |
| Post | One suggested carousel: 3 slides, two caption options, hashtags, and why the trend fits |
| Trusted post | A post that was approved, published, and passed the fidelity check. The North Star counts these |
| Fidelity check | Proof that the product pixels in every slide match the owner's original photo |
| Scene | The background, props and text Muse Image generates around a reserved product area |
| Trend | A trending format, topic, hashtag or sound from a public source |
| Style rules | Free text rules the owner sets once (for example "never show prices") |
| Activity panel | A live view of each loop step for a post: model, status, latency, cost |

---

## 3. Users and user stories

| Persona | Context | What they need |
| :--- | :--- | :--- |
| Food or snack seller (primary, demo hero) | Home business; sells on Instagram and a marketplace; runs everything from a phone | A good post every day without learning new tools |
| Fashion, craft or beauty seller | Visual products; sells through Instagram | Posts that show the product exactly as it is |

Design implication: owners use Marken in a phone browser. Mobile first, fast on a mid range Android phone, installable to the home screen.

| ID | As a... | I want to... | So that... |
| :--- | :--- | :--- | :--- |
| US-01 | seller | set up my shop by uploading photos | I can start in minutes |
| US-02 | seller | get one ready post every morning without asking | I never have to think about what to post |
| US-03 | seller | see why a trend fits my product | I trust the suggestion |
| US-04 | seller | approve a post with one tap | posting takes seconds, not an hour |
| US-05 | seller | tell the agent what to change in my own words | I don't need design skills |
| US-06 | seller | see my real product in every post | my customers get what they see |
| US-07 | seller | set rules once (tone, slang, no prices) | every post sounds like me |
| US-10 | new visitor | understand Marken before signing up | I know it is worth my time |
| US-11 | new seller | be walked through setup step by step | I get my first post without getting lost |
| US-14 | seller | see what the agent did and what it cost | I trust it to run every day |
| US-08 (P1) | seller | see which posts brought orders | I know what to do more of |

---

## 4. The agent loop and model routing

Marken is an agent, not a chat window. It runs this loop every day for each shop; the owner joins only at step 5.

| Step | What happens | Model |
| :--- | :--- | :--- |
| 1. Learn the shop | Owner uploads 3 to 10 product photos; products, prices and attributes are extracted | Muse Spark |
| 2a. Research trends **CHG** | An agent browses TikTok Creative Center and Google Trends and collects candidates | Muse Wonder (fallback: Muse Spark web search) |
| 2b. Score trends **CHG** | Each candidate scored 0 to 100 for fit and momentum | Muse Spark Open |
| 2c. Analyse trends **CHG** | Top trends analysed once (video and audio where they exist); cached 7 days for all shops | Muse Spark |
| 3. Plan content | Match one trend to one product; write 3 slide script, captions, hashtags, scene briefs | Muse Spark |
| 4. Make visuals **CHG** | Cut out the product; generate each scene with a reserved product area; place the original product pixels in code; verify | SAM 3.1 + Muse Image + code + Muse Spark |
| 5. Owner approves | Carousel appears on Today. Approve, Edit or Skip | None |
| 6. Publish | Carousel goes live on Instagram | None |
| 7. Learn (P1) | Record 24 hour metrics and owner entered orders | Muse Spark |

> **Pillar 1 in one line:** Muse Image never draws the product. It draws the world around it. The product pixels come from the owner's photo and are checked before anyone sees the post.

Every model call goes through one gateway that validates JSON, logs cost and latency, and falls back to Muse Spark Open for text when the Meta Model API fails.

---

## 5. Feature scope

18 P0 features ship in the demo. Three P1 features start only after the 2 Nov gate.

| ID | Feature | Model | Priority |
| :--- | :--- | :--- | :--- |
| F-01 | Landing page | None | P0 |
| F-02 | Account and auth (Google, email magic link; one shop per owner) | None | P0 |
| F-03 **CHG** | 5 step guided onboarding + tour on the first real post | Muse Spark | P0 |
| F-04 | Product extraction from photos | Muse Spark | P0 |
| F-05 | Style rules | Muse Spark | P0 |
| F-06 **CHG** | Trend research agent | Muse Wonder | P0 (fallback allowed) |
| F-16 **CHG** | Trend scoring | Muse Spark Open | P0 |
| F-07 **CHG** | Trend analysis, cached 7 days | Muse Spark | P0 |
| F-08 | Daily post plan (3 slides, captions, hashtags, scene briefs) | Muse Spark | P0 |
| F-09 **CHG** | Product studio: cutout + scene + composite | SAM 3.1 + Muse Image | P0 |
| F-26 **NEW** | Fidelity check and "Real product" badge with before and after view | Code + Muse Spark | P0 |
| F-22 **CHG** | 3 slide carousel output at 1080×1350 | Muse Image | P0 |
| F-10 | Today screen and approval | None | P0 |
| F-11 | Edit caption by feedback | Muse Spark | P0 |
| F-12 | Instagram carousel publishing (fallback: download + copy caption) | None | P0 |
| F-13 | Email reminder | None | P0 |
| F-24 | Agent activity panel (replaces cost log) | None | P0 |
| F-15 | Settings | None | P0 |
| F-17 | Results: 24 hour metrics, owner entered orders | None | P1 |
| F-18 | Weekly learning into shop memory | Muse Spark | P1 |
| F-11b | Regenerate a slide image from feedback | Muse Image | P1 |

If time runs short before the gate, cut in this order: F-13 email, F-15 settings (keep replay tour), F-11 edit. **Never cut F-26.**

---

## 6. User flow

A new owner goes Landing → Login → 5 step onboarding → Today. A returning owner goes straight to Today; an unfinished setup resumes at its saved step.

1. **Shop basics (required):** shop name, category, country, content language, time zone.
2. **Upload products (required):** 3 to 10 photos. SAM 3.1 cuts out each product; Muse Spark extracts name, price and attributes.
3. **Review (required):** edit, delete or add products. Owner confirms each cutout looks right.
4. **Voice and Instagram (optional):** tone, rules, live sample caption; connect Instagram or skip.
5. **First post + tour (optional tour):** the first real carousel is generated; coach marks walk through Today, the "Real product" badge and the activity panel.

While the first post generates, the tour runs on a sample post and swaps to the real one when ready. Target: sign up to first post in under 5 minutes.

---

## 7. Functional requirements

Every requirement is P0 unless marked P1. "Shall" means the demo fails review without it.

### 7.1 Landing, auth, onboarding (F-01, F-02, F-03)

| ID | Requirement | Acceptance |
| :--- | :--- | :--- |
| FR-LP-01 **CHG** | Landing at `/` shows headline ("Your real product, never redrawn"), 3 step how it works, a sample before and after carousel, and Get started | All visible at 360 px without horizontal scroll |
| FR-LP-03 | Logged in owner on `/` is redirected to the saved onboarding step or `/today` | Server side, no landing flash |
| FR-AU-01 | Sign in with Google OAuth or email magic link | Both create the same user; no password stored |
| FR-AU-04 | All routes need auth; data scoped to the owner's shop | Another owner's shop returns 403 or no rows |
| FR-OB-02 to 05, 08 **CHG** | The 5 steps in section 6 | Steps 1 to 3 required |
| FR-OB-09 | Tour runs on a sample post while the real one generates | Owner never waits on a blank screen |
| FR-OB-11, 12 | Progress saved server side per step; each step's start and finish logged | Reopen resumes; time to first post measurable |

### 7.2 Products and style rules (F-04, F-05)

| ID | Requirement | Acceptance |
| :--- | :--- | :--- |
| FR-SP-01 | Muse Spark extracts products as JSON: name, category, price, currency, attributes, description, source photo | 10 photos under 30 s; schema valid |
| FR-SP-02 | Price is null when not visible | No invented prices |
| FR-SP-09 **NEW** | SAM 3.1 cuts out each product at upload; owner confirms the cutout in step 3 | Confirmed cutout stored as transparent PNG |
| FR-SP-04, 05 | One tone + up to 10 rules (200 chars each), injected into every prompt | Rules editable in Settings |
| FR-SP-06 | Captions and slide text pass a rule check; fail → regenerate once, then flag | "Never show prices" shop never sees a price |

### 7.3 Trend engine (F-06, F-16, F-07)

| ID | Requirement | Acceptance |
| :--- | :--- | :--- |
| FR-TR-01 **CHG** | Daily, Muse Wonder browses TikTok Creative Center and Google Trends per country and category with an active shop; stores source, type, title, URL, collected at | Run log shows pages visited; fallback to Muse Spark web search is logged |
| FR-TR-05 **CHG** | Muse Spark Open scores each candidate 0 to 100 for fit and momentum | Only candidates above the threshold reach analysis |
| FR-TR-03 **CHG** | Muse Spark analyses each top trend once: hook, structure, visual style, why it works, as a scene brief | JSON stored; video and text sources marked |
| FR-TR-04 | Analyses cached 7 days and reused by every shop | Second shop triggers zero new analysis calls |
| FR-TR-06 | Each analysis keeps its source link, shown on Today as "Trend source" | Every suggestion traces to a public source |

### 7.4 Content and fidelity (F-08, F-09, F-26, F-22)

| ID | Requirement | Acceptance |
| :--- | :--- | :--- |
| FR-CG-01 **CHG** | Plan JSON: product ID, trend ID, fit reason, 3 slide script (hook, product, call to action), 2 captions, 5 to 15 hashtags, scene brief per slide | Schema valid; shop's content language |
| FR-CG-02 | No same product two days running; no skipped trend | Checked against the last 7 posts |
| FR-CG-04 **CHG** | Muse Image generates each scene at 1080×1350 with a **reserved empty product area** and slide text; it never receives an instruction to draw the product | Scene stored separately from the final slide |
| FR-CG-09 **NEW** | Code composites the confirmed cutout into the reserved area (scale, shadow); the product pixels are never passed back through a generative model | Deterministic, same input gives same output |
| FR-FD-01 **NEW** | Fidelity check: product region of each slide compared with the cutout; pass only if it matches within a set tolerance | Failed slide is rebuilt once, then the post is flagged |
| FR-FD-02 **NEW** | Muse Spark checks slide text is spelled correctly and follows style rules | Fail → scene regenerated once |
| FR-FD-03 **NEW** | Today shows a "Real product" badge on passed posts and a before and after toggle (owner photo vs slide) | Badge only when FR-FD-01 passes |
| FR-CG-06 | Plan and all 3 slides finish in under 3 minutes per shop | Measured in the activity log |

### 7.5 Today, edit, publish, reminder, activity (F-10, F-11, F-12, F-13, F-24)

| ID | Requirement | Acceptance |
| :--- | :--- | :--- |
| FR-TD-01 | Today: swipeable carousel, 2 captions, hashtags, why this trend fits, trend source, Approve, Edit, Skip | One scroll at most on 360 px |
| FR-TD-02 | Nothing publishes without Approve | Only status approved moves to publishing |
| FR-TD-03, 04 | Skip reason chips; clear states (generating, ready, publishing, published, failed, skipped) | Each state has its own UI |
| FR-ED-01, 02 | Regenerate caption from feedback; manual caption edit | Caption under 10 s; max 5 per post per day |
| FR-PB-01, 02, 03 | Publish carousel via Instagram Graph API as a background job, 3 retries; store media ID and permalink | Live post linked from Today |
| FR-PB-04 **CHG** | Not connected or review pending → download slides + copy caption | Approve flow always completes |
| FR-PB-05 | Instagram tokens encrypted and refreshed | No publish fails on an expired token |
| FR-NT-01, 02 | Email "Your post for today is ready" at the owner's time; link opens `/today` | Sent in the owner's time zone |
| FR-CL-01 | Every model call logged: step, model, tokens, images, latency, cost, cache hit, fallback | No call bypasses the gateway |
| FR-AP-01 | Activity panel lists each loop step live with model, status, latency, cost, plus the fidelity result | Matches the log rows |
| FR-CL-02 | Cost per post shown, with the share served from cache | Equals the sum of its logged calls |

### 7.6 P1 (after the gate)

`FR-RS-01` results (24 hour reach, likes, shares, saves, owner entered orders) · `FR-WL-01` weekly learning · `FR-ED-05` regenerate a slide image from feedback.

---

## 8. Non functional requirements

| ID | Category | Target |
| :--- | :--- | :--- |
| NFR-01 | Today load on a mid range Android phone over 4G | Under 2 s |
| NFR-04 | Sign up to first suggested post | Under 5 min median |
| NFR-05 | Owner time to review and approve | Under 2 min |
| NFR-06 **CHG** | Model cost per finished carousel (one time extraction and cached trends reported separately) | Under USD 0.10 |
| NFR-07 | Posts approved without edits, measured in the pilot | 50% or more, reported honestly |
| NFR-08 | PWA | Installable on Android Chrome and iOS Safari |
| NFR-09 | Responsive | 360 px to 1440 px |
| NFR-10 | Accessibility | AA contrast, 44 px tap targets, alt text on every slide |
| NFR-11 | Language | UI in English; content in English or Bahasa Indonesia |
| NFR-12 | Security | HTTPS; secrets server side; tokens encrypted; row level security per shop |
| NFR-13 | Uploads | Type and size checked; media through signed URLs |
| NFR-14 | Privacy | Owner can delete the shop and all media; only public trend data collected |
| NFR-15 | Reliability | Jobs idempotent and retried; one shop's failure never blocks another |
| NFR-16 **CHG** | AI safety | Nothing posts without Approve; schema validated output; product never redrawn |
| NFR-17 | Observability | Every failed post traces to its failing step in the activity panel |
| NFR-18 | Resilience | Text calls fall back to Muse Spark Open; fallback shown in the panel |
| NFR-19 | Licence | "Built with Muse Spark Open" in the footer and README |
| NFR-20 | Transparency | Slides labelled as AI assisted where Instagram requires it |

---

## 9. Architecture, data model and routes

One Next.js app serves the PWA and its API; Inngest runs the daily loop; every model call passes through one gateway, so the activity log and cost target cannot be bypassed.

| Layer | Choice |
| :--- | :--- |
| Web app | Next.js (App Router), TypeScript, Tailwind, PWA manifest, on Vercel |
| Auth, DB, storage | Supabase: Auth (Google, magic link), Postgres with RLS, Storage with signed URLs |
| Jobs | Inngest: cron (`trends.daily`, `posts.daily`) and on demand jobs, with retries; step events feed the activity panel |
| Models | Meta Model API: Muse Spark, Muse Wonder, Muse Image, SAM 3.1. Muse Spark Open on Baseten or Modal |
| Compositing and fidelity | Server side image library (for example `sharp`) |
| Publishing, email | Instagram Graph API (carousel); Resend |

### Data model (changes from v1.1 in bold)

| Table | Key fields |
| :--- | :--- |
| `users` | id, email, name, ui_locale |
| `shops` | id, owner_id (unique), name, category, country, content_language, time_zone, tone, notify_time, ig_account_id, ig_token (encrypted), onboarding_step, onboarding_completed_at, tour_completed_at |
| `onboarding_events` | shop_id, step, started_at, finished_at, skipped |
| `style_rules` | id, shop_id, text, position |
| `media_uploads` | id, shop_id, storage_path, bytes |
| `products` | id, shop_id, name, category, price, currency, attributes, description, hidden, **cutout_path**, **cutout_confirmed** |
| `trends` | id, source, type, country, category, title, url, source_rank, **score**, collected_at |
| `trend_analyses` | trend_id, hook, structure, **visual_style**, **scene_brief**, why_it_works, from_video, model, expires_at |
| `posts` | id, shop_id, product_id, trend_id, post_date, status, fit_reason, **slides (json: order, text, alt, scene_path, slide_path, fidelity_score, fidelity_passed)**, caption_options, chosen_caption, hashtags, skip_reason, ig_media_id, permalink, published_at |
| `post_revisions` | id, post_id, target, feedback, output |
| `model_calls` | id, shop_id, post_id, step, model, tokens in/out, images, latency_ms, cost_usd, cache_hit, fallback |

**Post status:** `generating → ready → approved → publishing → published` (or `failed`, `skipped`). Only `approved` can move to `publishing`. A **trusted post** = `published` + all slides `fidelity_passed`.

**Routes:** `/` · `/login` · `/onboarding/[step]` · `/today` · `/posts/[id]/edit` · `/products` · `/results` · `/settings`

**API:** `POST /api/uploads` · `POST /api/shops/:id/extract` · `PATCH /api/shops/:id/onboarding` · `POST /api/shops/:id/posts/generate` (Run now) · `POST /api/posts/:id/approve` · `POST /api/posts/:id/skip` · `POST /api/posts/:id/regenerate` · `GET /api/posts/:id/activity` · `GET /api/auth/instagram/callback` · cron `trends.daily` · cron `posts.daily`

---

## 10. Build plan

> **Gate: the full loop works end to end on the evening of 2 Nov.** Any slip before the gate comes out of P1, never out of the pilot or the video.

| Date | Build | Pilot and evidence |
| :--- | :--- | :--- |
| Thu 29 Oct | Skeleton, auth, DB schema, model gateway. **Smoke test the risky calls:** SAM 3.1 cutout, Muse Image scene with reserved area, Muse Wonder browsing, Instagram carousel publish | Recruit 4 sellers (keep 3) |
| Fri 30 Oct | Landing, login, onboarding steps 1 to 3, product extraction and cutout | Manual pilot starts; baselines recorded (EV-01) |
| Sat 31 Oct | Trend research, scoring, analysis cache. **Team meeting** | Manual pilot posts |
| Sun 1 Nov | Daily plan, product studio, compositing, fidelity check | Manual pilot posts |
| Mon 2 Nov | Today, approve, publish, email, activity panel. **Gate** | Manual pilot posts |
| Tue 3 Nov | Bug fixes only; P1 if the gate passed | In app pilot; demo footage recorded |
| Wed 4 Nov | Video, README, public repo check; submit by 9 PM ET | |

---

## 11. Pilot, evidence and demo video

Impact (30%) and demo (25%) are 55% of the score, so evidence starts on 30 Oct, before the app works.

| Phase | Dates | How | What is recorded |
| :--- | :--- | :--- | :--- |
| Manual pilot | 30 Oct to 2 Nov | 3 real sellers (recruit 4). Team runs the pipeline by hand, sends the carousel by chat, owner approves and posts | Approve, edit or skip; owner minutes; fidelity result; 24 hour reach and likes; reported orders |
| Dogfood | 30 Oct to 4 Nov | A team run demo shop with a real product (fallback if a seller drops) | Same metrics |
| In app pilot | 3 Nov | Same sellers use the full app | Time to first post, approve without edit rate, failures |

| ID | Requirement | Acceptance |
| :--- | :--- | :--- |
| EV-01 | Baseline per seller: how they post today and how long it takes | Written before their first Marken post |
| EV-02 **CHG** | Pilot log of every post | 12 or more trusted posts across 3 or more shops by 3 Nov |
| EV-03 | Honest results, including skips and failures | README and video show the real rates |
| EV-04 | Written consent to film and quote each seller | Before any footage |

### Demo video (under 3:00, English subtitles)

| Time | Scene | Pillar or criterion |
| :--- | :--- | :--- |
| 0:00 to 0:20 | Real seller on camera: how long posting takes today | Impact |
| 0:20 to 0:50 | Onboarding to first post in under 5 minutes (sped up, phone screen) | Works |
| 0:50 to 1:20 **CHG** | **Before and after:** a generic AI image vs Marken with the real product and its badge | Pillar 1, creativity |
| 1:20 to 1:50 | Activity panel: Muse Wonder browsing trends, SAM 3.1 cutout, Muse Image scene, fidelity check, cost | Pillars 2 and 3, Meta tools, depth |
| 1:50 to 2:20 | One tap approve; carousel live on Instagram | Works |
| 2:20 to 2:50 | Pilot numbers: trusted posts, approve rate, what did not work | Impact |

Also: README with model routing and pilot results (`DM-03`); a seeded demo account for judges, login in the submission form only (`DM-04`); post the demo on X for the viral and community prizes.

---

## 12. Risks and open questions

| Risk | Mitigation |
| :--- | :--- |
| Muse Image ignores the reserved product area | Mask the area in the prompt; code always paints the product last, so fidelity holds either way |
| Composited product looks pasted on | Shadow and scale in code; Muse Image edit pass on the scene only, then re-check fidelity |
| Muse Wonder browsing is slow or blocked | Fallback to Muse Spark web search, logged in the panel |
| No official trend API for TikTok or Instagram | State the limit openly in the video |
| Instagram publishing review is slow | Accounts the team or sellers own; download + copy caption fallback |
| Pilot sellers drop out | Recruit 4 to keep 3; the dogfood shop always runs |
| Judges see "another caption tool" | Lead the video with the seller and the before and after shot |
| Meta Model API limits from Indonesia | Confirm on 29 Oct; Muse Spark Open fallback for text |

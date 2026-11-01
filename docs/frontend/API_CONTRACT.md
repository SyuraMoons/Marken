# MARKEN Frontend — API Contract

What the frontend calls and what it expects back. Route list = SRD v2.0 §9 (do not add or rename routes without updating the SRD). Request/response **shapes are not in the SRD**; the ones below are the frontend's proposal, marked **[confirm: Harfi]** until the backend PR lands. When the real route ships, its code wins and this file gets updated.

Owner of the routes: Harfi (`src/app/api/**`). Frontend never edits route handlers.

---

## 1. Ground rules

- All calls are same-origin, cookie-authenticated (Supabase session). No tokens in JS.
- `401` → send to `/login`. `403`/`404` → "not found" state (another shop's data, FR-AU-04).
- Error body is always `{ "error": string, ... }` (matches `src/lib/http.ts`). `501 not_implemented` → show the screen with mock data in dev, an error state in prod.
- **Status changes go only through these routes.** The frontend never writes `posts.status` directly; the DB Approve Gate trigger will reject illegal moves anyway.
- Media URLs come from the server as **signed URLs**. Never build public storage URLs in the browser (NFR-13).

## 2. Data the frontend reads (Supabase, server components, RLS)

Types come from `src/lib/supabase/database.types.ts` (on `development`). Use `Tables<"posts">` etc.; don't redeclare them.

| Table | Fields the UI uses |
| :--- | :--- |
| `shops` | name, category, country, content_language (`en`/`id`), time_zone, tone, notify_time, ig_account_id (connected = not null), onboarding_step (1–5), onboarding_completed_at, tour_completed_at |
| `style_rules` | text (1–200 chars), position (1–10) |
| `products` | name, category, price (**null = not visible, show nothing, never "0"**), currency, attributes, description, hidden, source_upload_id, cutout_path, cutout_confirmed |
| `posts` | status, post_date, fit_reason, slides, caption_options, chosen_caption, hashtags, skip_reason, permalink, approved_at, published_at, trend_id |
| `trends` | title, url (shown as "Trend source"), source |
| `post_steps` | step, status (`running`/`succeeded`/`failed`/`skipped`), model, started_at, finished_at, detail |
| `model_calls` | step, model, latency_ms, cost_usd, cache_hit, fallback, tokens_in/out, images |

`posts.slides` item:
```ts
{ order: number; text: string; alt: string; scene_path: string; slide_path: string;
  fidelity_score: number; fidelity_passed: boolean }
```

Post status → screen:

| status | Screen |
| :--- | :--- |
| `generating` | generating (+ live activity) |
| `ready` | today review (Approve / Edit / Skip) |
| `approved`, `publishing` | publishing |
| `published` | published (link to `permalink`) |
| `failed` | failed; fidelity-failed when any slide `fidelity_passed = false` |
| `skipped` | skipped |
| no post today | generating or "Run now" |

"Real product" badge ⇔ `slides.length === 3 && slides.every(s => s.fidelity_passed)`.

## 3. Endpoints

### `POST /api/uploads` — signed upload URL (F-04, NFR-13) **[confirm: Harfi]**
```ts
// req
{ fileName: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; bytes: number }
// 200
{ uploadId: string; path: string; signedUrl: string; token: string }
```
Client then uploads the file to `signedUrl`. Validate type and size in the browser first (mirror the bucket limits), the server checks again.

### `POST /api/shops/:id/extract` — run extraction + cutout (F-04, FR-SP-09) **[confirm: Harfi]**
```ts
// req
{ uploadIds: string[] }        // 3–10
// 202
{ jobId: string }
```
UI then polls the `products` rows for the shop until every upload has a product or an error (`upload-error` screen for a failed photo).

### `PATCH /api/shops/:id/onboarding` — save a step (FR-OB-11, 12) **[confirm: Harfi]**
```ts
// req
{ step: 1 | 2 | 3 | 4 | 5; skipped?: boolean; data?: StepData }
// 200
{ onboarding_step: number; onboarding_completed_at: string | null }
```
Step 1 `data` = `{ name, category, country, content_language, time_zone }`. Step 4 `data` = `{ tone, rules: string[] }`. Steps 2/3 have no data (products already saved). Step 5 marks the tour done.

### `POST /api/shops/:id/posts/generate` — Run now (F-08) **[confirm: Harfi]**
```ts
// 202
{ postId: string }
// 409 { error: "post_exists" }  — today already has a live post
```

### `POST /api/posts/:id/approve` (FR-TD-02, F-12) **[confirm: Harfi]**
```ts
// req
{ caption: string }            // the chosen or manually edited caption
// 202
{ status: "approved"; publish: "instagram" | "download" }
// 409 { error: "illegal_status" }
```
`publish: "download"` → show the download + copy-caption screen (FR-PB-04). Approve always completes.

### `POST /api/posts/:id/skip` (FR-TD-03) **[confirm: Harfi]**
```ts
// req
{ reason?: "not_my_style" | "wrong_product" | "bad_timing" | "other"; note?: string }
// 200
{ status: "skipped" }
```

### `POST /api/posts/:id/regenerate` — caption from feedback (F-11) **[confirm: Harfi]**
```ts
// req
{ target: "caption"; feedback: string }   // "slide" is P1 (F-11b)
// 200
{ caption_options: string[] }
// 429 { error: "limit_reached" }          // 5 per post per day (FR-ED-01)
```

### `GET /api/posts/:id/activity` — activity panel (FR-AP-01, FR-CL-02) **[confirm: Harfi]**
*Route does not exist on `main` yet.*
```ts
// 200
{
  status: PostStatus;
  steps: { step: string; status: "running" | "succeeded" | "failed" | "skipped";
           model: string | null; latencyMs: number | null; costUsd: number;
           cacheHit: boolean; fallback: boolean; detail: unknown }[];
  totals: { costUsd: number; cacheShareUsd: number };
}
```
Not required by Today any more (FD-12: server reads + page refresh). Keep for other clients or the demo.

### `GET /api/auth/instagram/callback` (FR-OB-06, F-12)
Browser navigation only. Returns a redirect to `/onboarding/4?ig=connected|error` or `/settings?ig=...` **[confirm: Harfi]**.

### Auth **[confirm: Harfi]** — not built yet
No `src/app/login/actions.ts`, `src/proxy.ts` or `/auth/callback` exists yet, so the frontend builds the login UI presentational only. Expected once Harfi ships it: server actions in `src/app/login/actions.ts`: `signInWithGoogle`, `sendMagicLink` (→ `/login?sent=1` or `?error=generic|link|email`), `signOut`. OAuth returns to `/auth/callback`. `src/proxy.ts` handles the logged-in redirect from `/` and `/login` (FR-LP-03).

## 4. Writes without an SRD route

Plain CRUD on the owner's own rows goes through **server actions** with the RLS Supabase server client (no new API routes):
- products: edit, hide, delete, confirm cutout (`/onboarding/3`, `/products`)
- style rules + tone, shop basics, notify time (`/onboarding/4`, `/settings`)
- manual caption edit is sent with Approve (`caption` field), not saved separately

Open: delete shop (NFR-14) needs storage cleanup → needs a backend route. Ask Harfi.

## 5. Not used by the frontend

- `POST /api/push/subscribe` — web push is out of SRD v2.0 (email only). Don't build UI for it.

# Frontend integration review

Based on `development` at `d7d2e4f`. The existing frontend, API routes, Inngest jobs, Instagram adapter and model gateway are reused. This is an incremental review branch, not a claim that every Figma interaction is complete.

## Included

- Latest shared mobile navigation: header → five scrollable page links → content. Desktop sidebar retained. Activity and technical details select the Activity link.
- Five animated landing walkthroughs, responsive layouts, manual steps, pause, focus/hover pause and reduced-motion support. Sample content is identified; no action submits data.
- Today Activity displays stored job steps and model-call data, refreshing while a job is active.
- Both Today and Edit accept generated caption objects and legacy caption strings.
- Missing product images and Studio errors fail the job. The adapter no longer returns blank images as verified products.
- Current designer handoff replaces the older copy in this repository.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test:integration
pnpm build
pnpm typecheck
```

The regression tests exercise caption compatibility, missing cutouts, Studio errors and preservation of failed verification results. They isolate external services; they do not test a real generation or publication.

## Live setup and acceptance

Copy `.env.example` to `.env.local` and fill it locally. Never commit keys. Apply the existing Supabase migrations in order. Configure Google/Meta Auth providers and callback allowlists, then run the app and Inngest worker according to the root README. `GATEWAY_MODE=mock` is not a substitute for Supabase authentication or storage.

With a test business account, verify: sign in → company setup → photo upload → extraction/cutout confirmation → generation → inspect slides/captions and Activity → approve → Instagram or manual download. Verify errors and retry as well as success. A manual download must never be reported as publication.

## Remaining work before release

- Live Supabase, model, Inngest, email and Instagram flows have not been exercised in this review; credentials were intentionally deferred.
- Facebook publishing, per-product post scope, multiple photos per product, company description persistence and Results metrics still need their backend contracts. Existing UI must continue to explain unavailable features.
- Existing model/job adapters still contain mock or deterministic fallbacks beyond the corrected image-render path. Audit those before treating generated trend claims as live research.
- The latest one-screen-per-tab design still needs remaining sub-views converted into bounded panels/dialogs. This change does not complete that migration.
- Product switching currently links to Products; it does not select a global product scope.
- Final feature videos should be recorded from a configured test account. The landing sequences in this branch are sample UI walkthroughs, not recordings of live backend operations.
- Approved Privacy/Terms content and routes remain needed. No placeholder legal links are shipped.

PM review should include the shared navigation on all signed-in routes and compare the animated examples against the latest Figma branding. Do not merge as a declaration of end-to-end production readiness.

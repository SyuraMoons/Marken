# MARKEN Frontend — Decisions

Short log. One decision per entry; add new ones at the bottom, never rewrite old ones (mark them *Replaced by FD-xx*).

---

**FD-01 · Design source is Figma page "05 Full app — SRD v2" (`96:146`).** *Replaced by FD-20.*
Archive page (`0:1`) is dead — never slice from it. Moodboard and Components pages give tokens and button specs. `docs/images/user-flow.png` (8 steps, "TrenToko") is outdated.

**FD-02 · SRD v2.0 beats Figma.**
When a frame conflicts with the SRD (e.g. old "Play the demo" button, 8 setup steps, Notifications step), build what the SRD says and note it in the PR.

**FD-03 · Onboarding is 5 steps.**
`/onboarding/[1..5]`: shop basics · upload · review · voice + Instagram · first post + tour. The current `src/app/onboarding/[step]/page.tsx` lists 8 old steps and must be cut to 5 (DB checks `onboarding_step between 1 and 5`).

**FD-04 · Light theme only.**
Figma has no dark mode. Remove the `prefers-color-scheme: dark` override in `globals.css`.

**FD-05 · Inter replaces Geist.**
Loaded with `next/font/google` in `src/app/layout.tsx`.

**FD-06 · Tokens live in Tailwind v4 `@theme` in `globals.css`.**
No `tailwind.config`, no CSS modules, no hex values in components.

**FD-07 · Server Components by default.**
`"use client"` only for real interaction: carousel swipe, compare toggle, caption picker, forms with live state, activity polling, coach marks. Keep client components small and leaf-level.

**FD-08 · Reads via Supabase server client; status changes via API routes; other writes via server actions.**
See `API_CONTRACT.md`. Never change `posts.status` from the client.

**FD-09 · Build UI against typed mock data until backend routes return real data.**
Fixtures in `src/lib/mock/` typed with `database.types.ts` rows, so swapping to real data is a one-line change. Mocks never ship as real content; the tour sample post is labelled "Sample".

**FD-10 · No new UI dependencies.**
Carousel = CSS scroll-snap. Icons = inline SVG. Tour = own small component. Animation = CSS. Adding any package needs team agreement first.

**FD-11 · Responsive shell switches at `lg` (1024 px).** *Breakpoint kept; nav look replaced by FD-22.*
Below: bottom nav. At/above: 224 px sidebar + breadcrumb bar. Designed at 390 / 1440, verified at 360 / 1280.

**FD-12 · Activity panel refreshes, not realtime.**
Today reads `post_steps` + `model_calls` on the server (RLS) and `<AutoRefresh>` re-reads the page every 3 s while generating/publishing. `GET /api/posts/:id/activity` is then optional for the frontend.
Shortcut: switch to Supabase Realtime on `post_steps` if 3 s feels laggy in the demo.

**FD-13 · Results, result-detail, learning, image-edit are P1.**
Not built before the 2 Nov gate. The Results nav item stays and shows a simple "coming soon" placeholder until then.

**FD-14 · Web push is out.**
SRD v2.0 is email only. `POST /api/push/subscribe` is unused by the frontend.

**FD-15 · Real product badge is computed, never faked.**
Shown only when all 3 slides have `fidelity_passed = true`. No design-only "always on" badge, even in demo.

**FD-16 · Price shows only when not null.**
No "0", no placeholder price, no "Price on request" invented copy (FR-SP-02).

**FD-17 · Figma inconsistencies are fixed in code, not in Figma.** *Order of truth replaced by FD-21.*
`DESIGN_FIXES.md` lists them (`DX-xx`) and overrides the frames. Order of truth: SRD → DESIGN_FIXES → Figma.

**FD-18 · Approve is one tap from Today.** *Replaced by FD-30.*
The `approve` confirm frame is only used as the "Instagram not connected → download" choice (DX-01, US-04).

**FD-19 · Results P1 starts before the 2 Nov gate.**
Team permission granted 1 Nov; this replaces the timing in FD-13. Results, result-detail, learning and image-edit are built on typed mocks (FD-09) until a metrics/orders backend shape exists.

---

### 2 Nov design update (`Marken-Frontend-README.md`)

**FD-20 · Design source is page "00 Prototype — Complete app" (`96:146`) plus the 2 Nov handoff.**
Same node, renamed. Feature pages 01–05 (`213:1825`, `228:9961`–`228:9964`) are organized copies: when a copy disagrees with `96:146`, `96:146` wins and the difference is noted in the PR. `06 Wireframes` (`230:1220`) explains journeys only. `07 Visual direction` and `08 Components & motion` are references. Every page named "Archive" (`0:1`, `213:1824`, `213:867`, `4:3`, `213:771`) is dead.

**FD-21 · Order of truth: SRD → `Marken-Frontend-README.md` → `DESIGN_FIXES.md` (items not superseded) → Figma `96:146`.**
The README is the newest designer handoff, so it beats our 1 Nov fixes where they overlap (listed at the top of `DESIGN_FIXES.md`). The SRD still beats both (FD-02).

**FD-22 · New brand chrome: navy sidebar, glass mobile nav.**
Desktop sidebar and the login buttons use `navy` `#213D8C` with white text and icons. Mobile bottom nav is the glass bar from the README (navy gradient, 20 px blur, 26% white inner border, opaque `#213D8C` fallback, no blur under `prefers-reduced-transparency`). Active tab = white 20% fill + 18% white border; icons and labels stay white. `blue` `#2456DB` stays the primary action colour everywhere else (it is still the Figma variable). Replaces the nav and sidebar look in DX-21 and DX-23.

**FD-23 · Desktop login and email screens use their own `AuthShell`.**
A 400 px navy authentication panel flush to the left/top/bottom, form area flexible. Not the 224 px app sidebar. Mobile login keeps the single column.

**FD-24 · Loading is panel-level and tied to real completion.**
Loading specimens: uploading, preparing cutouts, regenerating scene, preparing captions, refreshing results (`270:513`–`270:1170`). Show skeletons only in the panel that is fetching, keep existing data, advance only when the operation really finishes (no timers), indeterminate unless real progress exists, `aria-busy` + `aria-live`, block double submit, keep drafts on error.

**FD-25 · Landing carousel autoplays with full controls.**
Three example states, 3.2 s per state, swipe, category controls, pause/resume, keyboard. No autoplay under `prefers-reduced-motion`; pause on hover, focus and when off-screen. Replaces the "hero product study 500 ms / 1.4 s" timing in DESIGN §6.

**FD-26 · Not built until the team changes the SRD (FD-02 applies).** ⛔ *Replaced by FD-29.*
The 2 Nov design adds things SRD v2.0 rules out or the backend cannot store. We keep the SRD behaviour and do not build these screens until the SRD is updated:
- Landing headline "Turn product photos into social posts." and "products or services" copy. FR-LP-01 requires "Your real product, never redrawn." and §2 puts service businesses out of scope.
- Facebook publishing (`share/publishing/published/download/downloaded-facebook`). §2: Facebook publishing is out of scope; there is no Facebook route.
- Meta sign-in (`auth-meta-opening/success/retry`). FR-AU-01 is Google + email magic link only.
- Product switcher and product-scoped Today/Products/Results/Settings (`Product switcher overlay`, `today-sample-product`). The data model allows one live post per shop per day (`posts_one_live_per_shop_day`), so a per-product Today needs a backend change.
- "Company description" field in setup step 1 and Settings. `shops` has no description column.

**FD-27 · New copy is adopted where it does not conflict with the SRD.**
UI wording follows the 2 Nov frames ("Company" instead of "Shop", "Review today's post", numbered field labels, settings row names). The SRD terms stay in code and data (`shops`, `shop_id`).

**FD-28 · Activity technical details is in scope.**
`activity-technical-details` (`189:707`) shows the per-step model, latency, cost, cache share and fallback from `post_steps` + `model_calls` (FR-AP-01, FR-CL-02). Its "EXAMPLE ACTIVITY · Not a live run" label is a designer note and is not shipped.

**FD-29 · The team changed the SRD (v2.1, amendments A-01 to A-07); the FD-26 items are in scope.**
Approved 2 Nov. Frontend builds the UI for: new landing headline and products-or-services copy (A-01, A-02), Meta sign-in (A-03), Facebook publishing choice (A-04), product switcher and product-scoped screens (A-05), company description (A-06). Each one ships only as far as its backend exists: until then the screen shows a clear "not available yet" or error state, never a fake success. Items the SRD marks **to decide** (service workflow, Facebook post format, post cadence per product) are not invented in the UI.

**FD-30 · Approve opens "Publish this post?" (`228:10628`).**
With Instagram and Facebook as destinations (SRD v2.1 A-04) the owner has to see where the post goes, so Today's Approve opens the publish screen; "Approve & publish" calls `POST /api/posts/:id/approve`. Facebook is shown but cannot be picked until its route exists. The chosen caption travels as `?c=` (option index) or `?caption=` (text edited in Edit), because owners cannot write `posts` directly (RLS select-only, FD-08). Replaces FD-18 and DX-01.

**FD-31 · Today sub-pages are `?view=` states of `/today`.**
`activity` (plain-language stages), `details` (Run details, live `post_steps` + `model_calls`), `compare`, `share`, `download`. No new routes, so the SRD route list stays unchanged.

**FD-32 · Prototype-only buttons in page 01 are not built.**
"Preview completed state", "Preview recovery state", "View failed-check state", "Change slide scene · P1" and the "Back to Today" button on screens that already are Today (DX-02). "Rebuild failed slide" becomes "Make a new post", because no route rebuilds a single slide.

**FD-33 · "Add one product" takes up to 3 photos, but uploads photo 1 only for now.**
Nalen's call (2 Nov): the screen follows Figma (`228:13807`, "One product · 3 photos"). Because each upload becomes its own product on the backend, only the first photo is sent and a note tells the owner the others are not used yet. Send all photos once API_CONTRACT §7 A-08 ships. No duplicate products are created meanwhile.

**FD-34 · Results shows Figma's empty state until a metrics backend exists.**
Page 03 (`228:14416`) shows "—  No 24-hour results yet" and the loading frame says results are never replaced with placeholder numbers. The old mock metrics and weekly-learning fixtures are deleted so no invented number can reach production. "Save orders" says nothing was saved until an orders table exists (F-17, P1). Replaces the mock part of FD-19.

**FD-35 · Settings: ready-post email shows "On", motion saves at once.**
Page 04 (`228:15583`) has a "Ready-post email" toggle, but no opt-out column exists and FR-NT-01 always sends, so it is a read-only "On" until Harfi adds one. Reduce motion saves on toggle (localStorage), so there is no separate "Save preferences" button. Deleting the shop now needs the owner to type the shop name (`228:15761`).

**FD-36 · Page 05 keeps backend rules where Figma differs.**
Setup step 1 keeps the Category field (the onboarding route requires it and trend research uses it) next to Figma's fields; the company description is shown disabled until `shops.description` exists (A-06). Step 2 still needs 3–10 photos (route `need_3_photos`), so "Add one product" sends every chosen photo. Step 3 reviews one photo at a time; "Replace this photo" uploads the new photo as a product and deletes the old one. Prototype-only buttons ("Preview signed-in state", "View upload error", "View result · prototype") are not built (FD-32). Every landing action leads to sign-in except "See a generated post", which opens the public `/example` before/after page (landing-compare); its Figma "Back to Today" becomes "Create your first post" + "Back to home" because the visitor is signed out. The Meta "You're signed in" screen is not built: the callback sends the owner straight into the app. Meta sign-in sets a short-lived cookie so a failed callback shows the Meta retry screen; the magic-link address is kept in a 10-minute httpOnly cookie for "Resend link" instead of the URL.


**FD-37 · Latest mobile web navigation supersedes FD-11/FD-22 bottom-bar placement.**
Five horizontal page links sit below the mobile header. The selected link uses blue textured glass on a white glass strip; labels remain opaque, bold, 13 px, and targets are at least 44 px. Activity continues to use `/today?view=activity`; both activity and details select Activity. Desktop keeps its 224 px navy sidebar.

**FD-38 · Landing walkthroughs are interactive sample sequences.**
Five feature sections use `FeatureDemo`: autoplay only while visible, pause on focus, manual steps, and reduced-motion support. They do not send requests or claim a completed upload, generation, or publication. Facebook and metrics limitations remain explicit. Real end-to-end recordings require a configured test account; sample walkthroughs are not evidence of live integration.

**FD-39 · Captions accept both database representations; render failures fail visibly.**
Generated jobs currently store `{label,text}[]`; older rows contain `string[]`. Both Today and Edit normalize these at the display boundary. Missing cutouts and Studio exceptions now reach the existing job failure handling, instead of returning a blank image with `fidelityPassed=true`.


**FD-40 · Continuous, compositor-friendly landing motion.**
Feature panels use a 12-second camera drift, layered product movement and 1.8-second eased lateral transitions. Copy remains mounted in a stable-height grid and crossfades. Hover no longer pauses playback; explicit pause, keyboard focus, offscreen suspension and reduced-motion controls remain. Animation uses transforms/opacity rather than per-frame React updates. Local Chrome frame scheduling had no >50 ms stalls in an eight-second sample; this is not a guarantee on all devices. Preview exports now use 30 fps rather than the earlier 4 fps capture.


**FD-41 · Redesign only the animated feature canvases.**
The surrounding landing sections, headings, copy, CTA buttons and composition are unchanged. `DemoScene` replaces the old static-card layouts inside `FeatureDemo` with five independent storyboards: photos assemble into a workspace; product scenes fan into a carousel; a caption editing overlay opens; a post branches toward sharing destinations; and a focus frame inspects Results. Native CSS transform/opacity transitions retain the existing playback controls and reduced-motion handling. Lint/build/typecheck passed; all five scenes visually checked, with no page overflow at 360/390/768/1280/1440. These remain sample walkthroughs, not live backend recordings.

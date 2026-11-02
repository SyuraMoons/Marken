# MARKEN Frontend — Design

Source: Figma `9FeEf6cIQUwKkn8OsPAI7b`.

| Figma page | Use it? |
| :--- | :--- |
| `96:146` 00 Prototype — Complete app | **The screens we build (canonical)** |
| `213:1825` 01 Today · `228:9961` 02 Products · `228:9962` 03 Results · `228:9963` 04 Settings · `228:9964` 05 Start & onboarding | Organized copies. If a copy disagrees with `96:146`, `96:146` wins (FD-20) |
| `230:1220` 06 Wireframes — Connected flows | Journeys only |
| `4:2` 07 Visual direction · `4:4` 08 Components & motion | References |
| Every page named "Archive" (`0:1`, `213:1824`, `213:867`, `4:3`, `213:771`) | **No. Never slice from them.** |

Order of truth (FD-21): **SRD → `Marken-Frontend-README.md` (2 Nov handoff) → `DESIGN_FIXES.md` → Figma `96:146`.**
The SRD v2.1 amendments (A-01 to A-07) bring the whole 2 Nov design in scope (FD-29).

---

## 1. Direction

"Light. Fluid. Yours." Blue confidence, white space, a little pink atmosphere. The product photo is the hero; UI chrome stays quiet.

Principles from the moodboard:
- One decision per screen.
- Required setup before Today.
- Explicit approval before publishing.
- Short fades; static alternative for reduced motion.

## 2. Tokens

Defined once in `src/app/globals.css` (`@theme`), used as Tailwind classes (`bg-surface`, `text-ink`...). Never hard-code hex in components.

| Token | Hex | Use |
| :--- | :--- | :--- |
| `ink` | `#111B36` | Headings, body text |
| `muted` | `#64708A` | Secondary text, labels |
| `blue` | `#2456DB` | Primary action, links (still the Figma variable) |
| `navy` | `#213D8C` | Desktop sidebar, auth panel and login buttons, mobile nav fallback (FD-22) |
| `white` | `#FFFFFF` | Cards, canvas |
| `surface` | `#F4F6FC` | App background (desktop), secondary buttons |
| `border` | `#E5E9F4` | Card and input borders |
| `pink` | `#F2B1E6` | Atmosphere gradient only (never text) |
| `powder` | `#DBE9FF` | Atmosphere gradient, selected chips |
| `danger` | `#B42318` | Delete / error text. *Not in Figma yet — AA safe placeholder* |

Atmosphere background (landing, login, onboarding, carousel frame only): soft gradient `powder` → `white` → `pink` at low opacity. Cards on top are solid `white`. Signed-in app screens use flat `surface` (DX-24). Never put `muted` text directly on the gradient (DX-40).

Mobile glass nav (FD-22, values from the README): background `linear-gradient(180deg, rgb(51 84 171 / 88%), rgb(33 61 140 / 82%))`, `backdrop-filter: blur(20px)`, 1 px inside border white 26%, shadow `0 6px 20px rgb(13 26 69 / 18%)`. Opaque `navy` fallback when blur is unsupported or `prefers-reduced-transparency: reduce`. Put the alpha on the background, never on the whole element, so icons and labels stay opaque.

### Type (Inter, via `next/font`)

| Style | Size / line | Weight | Use |
| :--- | :--- | :--- | :--- |
| Display | 36 / ~42 | 600 | H1 on mobile ("Your morning, sorted.") |
| Title | 32 / ~38 | 600 | H1 on desktop, landing sub-headline |
| Section | 20 / 28 | 600 | Card titles ("Your caption") |
| Body M | 16 / 22 | 500 | Buttons, emphasised body (`Marken/Medium/16`) |
| Body | 16 / 24 | 400 | Paragraphs |
| Small | 14 / 20 | 400 | Meta text, hashtags (`Marken/Regular/14`) |
| Micro | 12 / 16 | 500 | Eyebrows, step labels ("2 of 5 · Product photos") |

### Shape and spacing

- Page gutter: **24 px** on mobile (Figma: 390 frame, 25 px inset; 360 px QA frames still fit).
- Mobile content: 24 px top, 32 px bottom, plus the bottom-nav height and safe-area inset so nothing hides under the glass nav.
- Card: white, 1 px `border`, radius ~**20 px**, padding **20–24 px**. Major blocks 24–28 px apart. Cards grow with content: no fixed text heights.
- Landing sections: 48 px vertical padding on mobile, 64 px on desktop. Landing photo panels: radius 5–8 px, tilted (2D approximation).
- Buttons (component `Marken/Button/*`), only these heights (DX-25):
  - Primary: 52 px tall, full width on mobile, `blue` fill, white Body M, radius ~14 px.
  - Secondary: 52 px tall, `surface` fill, `border` stroke, ink text.
  - Text: 44 px tall, no fill, `blue` text.
  - Danger: primary shape with `danger` fill (confirm) or text button in `danger` (entry link).
  - Which one to use: the button rules in `DESIGN_FIXES.md`.
- Input: 52 px, **white** fill, `border` stroke, placeholder in `muted` — must not look like a secondary button (DX-03).
- Tap targets ≥ **44 px** (NFR-10).
- Exact radii/shadows: confirm per screen with `get_design_context` while slicing; then lock them here.

## 3. Layout

| Viewport | Shell |
| :--- | :--- |
| < 1024 px (mobile/tablet) | 64 px header (wordmark + company name), content column, 72 px **glass bottom nav** (FD-22) with icon + label: Today · Products · Results · Settings, always visible, content padded for nav + safe area. Active tab follows the section (DX-22, DX-23) |
| ≥ 1024 px (desktop) | **Navy 224 px sidebar on every signed-in screen** (FD-22): wordmark, nav rows icon + label in white, company card at bottom; no "View agent activity". Sidebar and main area are siblings in a row (`minmax(0, 1fr)` / `min-width: 0` on main); never nest the sidebar in a vertical stack. Breadcrumb top bar, content on `surface` with white cards; Today uses 2 columns (carousel · review panel) (DX-20, DX-11) |
| Desktop login + email | **`AuthShell`** (FD-23): 400 px navy panel flush left/top/bottom, flexible form area. Mobile login stays one column |

Landing and setup screens have no app nav. Tablet widths are not specified in Figma: stay fluid between 360 and 1440 and test at 768.
Must work 360 → 1440 px with no horizontal scroll (NFR-09, FR-LP-01).

## 4. Components (build these once, in `src/components/`)

Built: `Button`/`ButtonLink`, `AppShell` (+`AppNav`), `SetupShell`, `Carousel`, `ProductCheck` (badge + compare in one), `ActivityPanel`, `ReviewPanel` (caption picker + skip chips inline), `StatusScreen`, `CopyButton`, `ActionButton`, `Logo`, `ListRow`, `Placeholder`, `DownloadFlow`, `UploadError`, `SaveAndExit`, `InstallMarken`, `ResultsView`.
New for the 2 Nov design: `AuthShell` (FD-23), `LandingCarousel` (FD-25), `LoadingPanel` (FD-24), `Alert`, `Dialog`, `ProductSwitcher` (A-05), `PlatformSelect` (Instagram/Facebook, A-04). Still planned: `Chip`, `Card`, `Field`, `CoachMark` — extract them when their screen lands, don't build ahead.

| Component | Notes |
| :--- | :--- |
| `Button` | variants `primary` / `secondary` / `text` / `danger`; renders `<button>` or `<Link>` |
| `ListRow` | settings rows: label, current value, chevron (DX-06) |
| `Chip` | single-select chips, e.g. skip reasons (DX-05) |
| `Card` | white, bordered, rounded |
| `AppShell` | glass bottom nav (mobile) + navy sidebar (desktop) |
| `AuthShell` | desktop 400 px navy panel + form area; mobile single column |
| `LandingCarousel` | 3 example states, 3.2 s autoplay, swipe, category controls, pause/resume, keyboard, no autoplay with reduced motion |
| `LoadingPanel` | skeleton for one panel, `aria-busy`, indeterminate unless real progress |
| `SetupShell` | ← Back · Save and exit · 5-segment progress bar · "N of 5 · Label" |
| `Carousel` | 4:5 slides, CSS scroll-snap swipe, dots, labels `01 / Hook · 02 / Product · 03 / CTA`, alt text on every slide |
| `RealProductBadge` | "✓ Real product · Compare"; rendered **only** when every slide `fidelity_passed` |
| `CompareToggle` | before (owner photo) / after (slide) |
| `CaptionPicker` | 2 options, "Choose caption · 1 of 2", Copy |
| `ActivityStep` | step name, model, status, latency, cost |
| `StatusScreen` | icon + headline + body + next action (generating / publishing / published / failed / skipped / errors) |
| `CoachMark` | tour bubble anchored to a target |
| `Field` | label + input/select/textarea + error, 44 px min height |

Icons: small inline SVGs in `src/components/icons.tsx` (Figma desktop uses simple line icons). No icon library.
Wordmark: "marken" with small blue/pink offset accents (2 Nov). Text or SVG with one accessible name; decorative copies are hidden from screen readers.

## 5. Screen map (page `96:146`)

Every screen has a Mobile and Desktop frame; node IDs below are the **Mobile** frame (Desktop is listed next to it in Figma).

### Start + setup
| Screen | Route | Node |
| :--- | :--- | :--- |
| landing | `/` | `97:1922` (desktop `97:1945`) |
| landing-compare | `/` (before/after section) | `98:1488` |
| login | `/login` | `97:1972` |
| email (check inbox) | `/login?sent=1` | `97:2016` |
| setup-shop (1/5) | `/onboarding/1` | `97:2058` |
| setup-upload (2/5) | `/onboarding/2` | `97:2142` |
| upload-error | `/onboarding/2` state | `97:2873` |
| setup-review (3/5) | `/onboarding/3` | `97:2222`, `98:868`, `98:954` |
| setup-details | `/onboarding/3` product edit | `98:1119` |
| setup-voice (4/5) | `/onboarding/4` | `97:2308` |
| setup-connected | `/onboarding/4` after IG | `98:1227` |
| tour / tour-fidelity / tour-activity (5/5) | `/onboarding/5` → `/today` | `97:2396`, `97:2466`, `97:2542` |
| resume | shown when setup unfinished | `97:2638` |

### Main app
| Screen | Route | Node |
| :--- | :--- | :--- |
| today (slide 1/2/3) | `/today` (`ready`) | `97:146`, `98:650`, `98:759` |
| caption-alt | `/today` caption picker | `97:2676` |
| compare | `/today` before/after | `97:567` |
| activity | `/today` activity panel | `97:478` |
| generating | `/today` (`generating`) | `97:989` |
| approve | approve confirm | `97:715` |
| publishing | `/today` (`approved`/`publishing`) | `97:2749` |
| published | `/today` (`published`) | `97:782` |
| download / downloaded | IG fallback (FR-PB-04) | `97:845`, `98:1340` |
| skip / skipped | skip reasons / `skipped` | `97:920`, `97:2816` |
| failed | `/today` (`failed`) | `97:1056` |
| fidelity-failed | `failed` + slide not passed | `97:2937` |
| edit | `/posts/[id]/edit` | `97:636` |
| products | `/products` | `97:255` |
| product-check / product-edit / product-add / product-delete / product-error | `/products` flows | `98:1040`, `97:1121`, `97:1222`, `98:1431`, `98:1538` |
| settings | `/settings` | `97:405` |
| shop / brand / instagram / connected / reminders / account / delete / deleted | `/settings` sub-views | `97:1498`, `97:1579`, `97:1650`, `98:1287`, `97:1707`, `97:1782`, `97:1859`, `98:1397` |
| results / result-detail / learning / image-edit **[P1]** | after the 2 Nov gate only | `97:324`, `97:1295`, `97:1366`, `97:1427` |

### Added 2 Nov
| Screen | Route / place | Node (mobile / desktop) | Status |
| :--- | :--- | :--- | :--- |
| landing-carousel 2, 3 + paused | `/` carousel states | `244:569`, `244:811` / `244:1069`, `244:1311`; paused `245:477`, `245:729` / `245:987`, `245:1239` | build (FD-25, A-01) |
| uploading | onboarding 2, Products add | `270:513` / `270:578` | build (FD-24) |
| preparing-cutouts | onboarding 2 to 3, Products add | `270:661` / `270:726` | build |
| regenerating-scene | Edit (slide remake) | `270:809` / `270:874` | build, route still caption-only |
| loading-captions | Edit (caption rewrite) | `270:957` / `270:1022` | build |
| loading-results | `/results` | `270:1105` / `270:1170` | build |
| activity-technical-details | `/today?view=activity` | `189:707` / `189:754` | build (FD-28) |
| auth-meta-opening / success / retry | login | `176:695`, `176:704`, `176:714` / `176:729`, `176:738`, `176:748` | build UI (A-03); needs Meta provider in Supabase Auth |
| share / publishing / published / download / downloaded -facebook | Today | `227:533`, `227:583`, `227:639`, `230:2416`, `230:2484` / `227:732`, `227:801`, `227:876`, `230:2535`, `230:2622` | build UI (A-04); needs Facebook publish route |
| Product switcher overlay, today-sample-product | app header | `186:918`, `186:701` / `186:917`, `186:790` | build UI (A-05); cadence **to decide**, needs per-product posts |

The README lists "Download complete" as `98:1342`; the frame is `98:1340` (mobile) / `98:1366` (desktop).

QA frames: `100:1050`–`100:1173` (360 px), `100:1207` (1280 px), `100:1264` / `100:1291` (reduced motion landing).

## 6. Motion

- Setup step change: 200 ms dissolve.
- Landing carousel: 3.2 s per state, pause on hover/focus/off-screen, no autoplay with reduced motion (FD-25).
- `prefers-reduced-motion`: static landing, instant transitions.
- `prefers-reduced-transparency`: opaque nav, no blur (FD-22).
- CSS transitions only; no animation library.

## 7. Copy

- UI copy comes from Figma frame titles/bodies, stored in `messages/en.json` and read with `t()`.
- Figma notes like "Illustrative design sample", "Example rationale · source must come from…", "ILLUSTRATIVE RUN", "EXAMPLE ACTIVITY · Not a live run" are **designer annotations — do not ship them**. Neither are the "View result · prototype" / "View recovery · prototype" buttons. The only exception is the tour sample post, which must be labelled "Sample".
- 2 Nov wording is adopted (FD-27): "Company" in UI, "Review today's post", numbered field labels ("01 Company name"). The landing headline is "Turn product photos into social posts." (SRD A-01).
- Post content (captions, slide text) is in the shop's content language (EN or ID); UI is English.

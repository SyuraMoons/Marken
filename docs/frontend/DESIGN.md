# MARKEN Frontend — Design

Source: Figma `9FeEf6cIQUwKkn8OsPAI7b`.

| Figma page | Use it? |
| :--- | :--- |
| `0:1` Archive — Earlier mobile exploration | **No. Never slice from it.** |
| `4:2` 01 Moodboard | Palette, mood, principles |
| `4:3` 02 Wireframes | Layout reference only |
| `4:4` 04 Components & motion | Buttons, motion spec, 360 px checks |
| `96:146` 05 Full app — Mobile + Desktop · SRD v2 | **The screens we build** |

If Figma and `docs/SRD.md` disagree, the SRD wins (see `DECISIONS.md`).
Known Figma inconsistencies and their code fixes are in `DESIGN_FIXES.md` — **it overrides the Figma frames**.

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
| `blue` | `#2456DB` | Primary action, links, active nav |
| `white` | `#FFFFFF` | Cards, canvas |
| `surface` | `#F4F6FC` | App background (desktop), secondary buttons |
| `border` | `#E5E9F4` | Card and input borders |
| `pink` | `#F2B1E6` | Atmosphere gradient only (never text) |
| `powder` | `#DBE9FF` | Atmosphere gradient, active nav fill |
| `danger` | `#B42318` | Delete / error text. *Not in Figma yet — AA safe placeholder* |

Atmosphere background (landing, login, onboarding, carousel frame only): soft gradient `powder` → `white` → `pink` at low opacity. Cards on top are solid `white`. Signed-in app screens use flat `surface` (DX-24). Never put `muted` text directly on the gradient (DX-40).

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
- Card: white, 1 px `border`, radius ~**20 px**, padding 16–20 px.
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
| < 1024 px (mobile/tablet) | 64 px header (`marken ✦` + shop name), content column, 72 px **bottom nav** with icon + label: Today · Products · Results · Settings. Active tab follows the section (DX-22, DX-23) |
| ≥ 1024 px (desktop) | **Left sidebar 224 px on every signed-in screen** (logo, nav rows icon + label, shop card at bottom; no "View agent activity"), breadcrumb top bar (`Workspace / today`), content on `surface` with white cards; Today uses 2 columns (carousel · review panel) (DX-20, DX-21, DX-11) |

Setup and landing screens have no nav, only the header.
Must work 360 → 1440 px with no horizontal scroll (NFR-09, FR-LP-01).

## 4. Components (build these once, in `src/components/`)

Built: `Button`/`ButtonLink`, `AppShell` (+`AppNav`), `SetupShell`, `Carousel`, `ProductCheck` (badge + compare in one), `ActivityPanel`, `ReviewPanel` (caption picker + skip chips inline), `StatusScreen`, `CopyButton`, `ActionButton`, `Logo`, `ListRow`, `Placeholder`. Still planned: `Chip`, `Card`, `Field`, `CoachMark` — extract them when their screen lands, don't build ahead.

| Component | Notes |
| :--- | :--- |
| `Button` | variants `primary` / `secondary` / `text` / `danger`; renders `<button>` or `<Link>` |
| `ListRow` | settings rows: label, current value, chevron (DX-06) |
| `Chip` | single-select chips, e.g. skip reasons (DX-05) |
| `Card` | white, bordered, rounded |
| `AppShell` | bottom nav (mobile) + sidebar (desktop) |
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

QA frames: `100:1050`–`100:1173` (360 px), `100:1207` (1280 px), `100:1264` / `100:1291` (reduced motion landing).

## 6. Motion

- Setup step change: 200 ms dissolve.
- Landing hero product study: 500 ms ease, 1.4 s hold.
- `prefers-reduced-motion`: static landing, instant transitions.
- CSS transitions only; no animation library.

## 7. Copy

- UI copy comes from Figma frame titles/bodies, stored in `messages/en.json` and read with `t()`.
- Figma notes like "Illustrative design sample", "Example rationale · source must come from…", "ILLUSTRATIVE RUN" are **designer annotations — do not ship them**. The only exception is the tour sample post, which must be labelled "Sample".
- Post content (captions, slide text) is in the shop's content language (EN or ID); UI is English.

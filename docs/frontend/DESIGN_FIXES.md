# MARKEN Frontend — Design Critique & Fixes

Review of Figma page `96:146` "05 Full app — Mobile + Desktop · SRD v2" (Archive ignored), 1 Nov 2026.
We **don't patch Figma**; we fix these in code. When slicing, **this file overrides the Figma frame**. Each fix has an ID (`DX-xx`) — reference it in the PR.

How it was checked: layer data for all 108 frames (sizes, component instances, text) + screenshots of today, landing, login, setup-upload, products, settings, activity, generating (mobile) and today, products, activity (desktop).

---

## Overall impression

The direction is strong: calm blue/white/pink, the product photo is the hero, and every post state has its own screen with a clear next action. The biggest problem is that **two design passes are mixed**: the 4 main tabs use one shell and every other screen uses another, and many frames still carry prototype-only buttons and designer notes. Fixing the shell and the button rules fixes most of what feels "off".

## Usability

| ID | Finding | Severity | Fix in code |
| :--- | :--- | :--- | :--- |
| DX-01 | **Approve takes two taps.** Today "Approve post →" opens a confirm screen ("Approve & publish"). SRD US-04 promises one tap. | 🔴 Critical | Approve on Today calls the API directly. The `approve` screen is only shown when Instagram is not connected (it becomes the download choice). |
| DX-02 | **Prototype-only buttons look like real actions**: "Preview completed state", "Preview recovery state", "Preview signed-in state", "View failed-check state", "View upload error", "Change slide scene · P1". On `generating`, the fake one is even the primary button. | 🔴 Critical | Never build them. State changes come from data. On `generating` the only actions are "See live steps" (secondary) and the nav. |
| DX-03 | **Login: the email input and "Send sign-in link" button look the same** (same fill, border, height, radius). Placeholder text is ink-coloured, so it reads like a typed value. | 🔴 Critical | Input: white fill, `border`, left-aligned, placeholder in `muted`. Button: keep secondary style. |
| DX-04 | **landing-compare ends with "Back to Today"**, but logged-out visitors can't reach Today. | 🔴 Critical | Landing compare section CTA = "Get started" (→ `/login`). |
| DX-05 | **Skip reasons are full-width buttons** that look like they skip right away, then there's another "Skip this post" primary. | 🟡 Moderate | Reasons are selectable chips (one choice) + optional note + one primary "Skip this post" + text "Keep the post" (FR-TD-03). |
| DX-06 | **Settings items are centred secondary buttons**, so they look like actions, not places to go. | 🟡 Moderate | Left-aligned list rows inside one card: label, current value in `muted` (e.g. "08:00"), chevron. Rows ≥ 52 px. |
| DX-07 | **Products page has no list.** Mobile shows one giant hero image with fake slide text ("The original.") and puts "Add product" inside one product's card. Real shops have 3–10 products. | 🟡 Moderate | Grid of product cards (cutout thumb, name, category, price only if not null). "Add product" is a page-level primary under the title (desktop: top-right). No decorative hero. |
| DX-08 | **Back on step 1** goes nowhere; Back/Save-and-exit are centred in two halves, so they don't line up with the content edge. | 🟢 Minor | Hide Back on step 1. Back left-aligned, "Save and exit" right-aligned. |
| DX-09 | **Last review photo still says "Looks right · next photo".** Main-app `product-check` also says "next photo" for a single new product. | 🟢 Minor | Label is "Looks right · next photo" only when another photo is left, else "Looks right · continue" (setup) / "Save product" (products). |
| DX-10 | **One destination, four labels**: "View agent activity", "See live steps", "View activity", "View failing step". | 🟢 Minor | One label: "See agent activity". On failed states: "See what went wrong" (opens activity scrolled to the failed step). |
| DX-11 | **Activity is a global nav item on desktop** ("View agent activity" in the sidebar) but activity belongs to one post. | 🟢 Minor | Remove from the sidebar. Open it from the post (Today, failed, skipped). |
| DX-12 | **Today: "Edit caption" (secondary button) and "Skip this post" (text link) sit side by side** as a pair but look unrelated. | 🟢 Minor | Under Approve: two equal secondary buttons "Edit caption" · "Skip", or one row of two text buttons. We pick two equal secondary buttons. |
| DX-13 | **Upload tile remove "×" is 20 × 20 px** (components page). | 🟡 Moderate | 44 × 44 px hit area (visual can stay 24 px) with `aria-label="Remove photo N"`. |

## Visual hierarchy

- **What draws the eye first:** the product slide. ✅ Correct — it's the promise.
- **Second:** on Today the big blue "Approve post" sits below two long cards, so you scroll past caption + trend reason to find it. Acceptable on mobile (SRD allows one scroll), keep it.
- **Landing competes with itself:** H1 "Your real product, never redrawn." is followed by a second, blue, almost-as-big headline "A fresh perspective. Every single morning." (**DX-14**, 🟡). Fix: drop the blue line or make it Body size in `muted`. One headline per screen.
- **Landing is missing SRD content (DX-15, 🔴):** FR-LP-01 needs a visible 3-step how-it-works and a before/after sample. Mobile shows the steps as one run-on line and only one image. Fix: 3 short numbered rows, and a before/after pair (owner photo → slide) directly on `/`.
- **Text over product imagery:** the decorative heroes on products and setup-upload print a headline across the product (the text hits the bottle cap) (**DX-16**, 🟢). Fix: no text overlays on product images in UI; real slides already contain their own text.

## Consistency

| ID | Element | Issue | Fix in code |
| :--- | :--- | :--- | :--- |
| DX-20 | **Desktop shell** | Main tabs: 224 px sidebar with line icons, breadcrumb bar, flat `surface` background. Every other screen: 82 px top bar, floating "Your workspace" card with centred text links, no icons, tagline text, gradient background. | **One `AppShell` for every signed-in desktop screen**: the sidebar version. Flat `surface` background, white cards. |
| DX-21 | **Desktop sidebar items** | Icon sits left, label is centred/offset higher than the icon; active state = powder fill **plus** an inner blue outline box that doesn't wrap the label. | Row: icon + label left-aligned in one 44 px row, gap 12. Active = `powder` fill + `blue` text + icon. No outline. |
| DX-22 | **Mobile header** | Height 58 on today/slide2/3, 74 elsewhere; main tabs are 384/392 px wide vs 390. | One header, 64 px, full width. |
| DX-23 | **Mobile bottom nav** | 78 px on main tabs, 74 elsewhere. Active tab is a filled blue pill that is 52 px tall while others are 48 (it jumps). Sub-screens (activity, generating, edit…) have **no** active tab. No icons (desktop has icons, components page used ⌂ ◇ ⚙ glyphs). | One 72 px nav: 4 items, icon + label, all the same size. Active = `blue` icon + label + small `powder` pill behind the icon. Active tab follows the section (`/today/*`, edit, activity → Today; product screens → Products; settings screens → Settings). |
| DX-24 | **Background** | Gradient on all mobile screens and desktop sub-screens, flat on desktop main tabs. | Gradient only on public + setup screens (landing, login, onboarding). Signed-in app: flat `surface` (mobile and desktop). Keeps the post imagery as the only colour. |
| DX-25 | **Button sizes for the same action** | "Back to Today" 52 px on 12 frames, 48 px on 8; "Skip this post" 44/48/52; "Delete product" 48 and 52; settings rows 52 and 56. | Three heights only: primary/secondary **52**, text **44**. See button rules below. |
| DX-26 | **Which style a button gets** | Same action is primary on one screen, secondary or text on the next ("Back to Today", "Download instead"). Some screens have two primaries. | **Button rules** (below). |
| DX-27 | **Destructive actions** | "Delete shop permanently", "Delete product", "Delete shop & all media" have no danger style. | Destructive confirm = primary shape in `danger` fill. Destructive entry links = text button in `danger`. |
| DX-28 | **Arrows in labels** | "Approve post →", "Get started →", "Finish tour → Today", "Skip tour → Today", "← Back"; most others have none. | Only "← Back" keeps an arrow. Remove arrows from every other label ("Finish tour", "Skip tour"). |
| DX-29 | **Setup step indicator** | Components page: bar then "2 of 5 · Product photos"; SRD v2 frames: "STEP 2 OF 5 / Upload products" above the bar. Step names drift ("Your shop" vs SRD "Shop basics"). | SRD v2 frame style: eyebrow "STEP N OF 5 / Name", then 5-segment bar. Names: Shop basics · Upload products · Review products · Voice & Instagram · First post + tour. |
| DX-30 | **Header right slot** | "Rani Studio" (app), "REAL PRODUCT. REAL YOU." (public), "SETUP" (onboarding), "Rani Studio · RS" (desktop main), "Rani Studio" next to the logo (desktop sub-screens). | Signed-in: shop name (desktop adds initials avatar). Onboarding: nothing (the step eyebrow already says it). Public: "Log in" text link on landing, nothing on login. |
| DX-31 | **Wordmark / name** | "marken·" (components page) vs "marken ✦" (SRD v2); copy uses "Marken", code uses "MARKEN". | Logo = "marken ✦" wordmark. In sentences write "Marken". `app.name` stays "MARKEN" only for metadata/manifest. |
| DX-32 | **Duplicate titles** | Edit caption and setup voice both titled "Make it sound like you."; Today and slide2/slide3 duplicate whole frames. | Edit caption title → "Make this caption yours." Slide 2/3 are carousel states, not screens. |
| DX-33 | **Slide labels** | Today labels "01 / Hook", "02 / Product", but the third instance is "Slide 3 · Call to action" (renders "03 / CTA"). Labels are 48 px buttons with no selected state. | Labels `01 / Hook · 02 / Product · 03 / CTA`, current one in `blue`, others `muted`, tap jumps to the slide. Same component on mobile + desktop. |
| DX-34 | **Hashtags look like links** | Hashtags, "Choose caption", "Trend source" all in the same blue. | Hashtags in `muted`. Blue only for things you can tap. |
| DX-35 | **Links inside cards** | Text buttons are centred inside left-aligned cards. | Links inside cards are left-aligned; only page-level text buttons under a full-width primary are centred. |
| DX-36 | **Jargon** | "View fidelity check", "Product check: passed state", "verification state". | UI word is "Product check" everywhere; badge "Real product". "Fidelity" never appears in UI copy. |
| DX-37 | **Designer notes in the UI** | "Illustrative design sample · verification state shown for review", "Example rationale · source must come from…", "ILLUSTRATIVE RUN · Example states…", "@rani.studio · Example connected state", "Published state", "Illustrative product". | Never ship. Only the tour sample post gets a "Sample" tag. |
| DX-38 | **Caption copy action** | "Copy" is on the components page Today but missing on SRD v2 Today. | Caption card header: "Your caption" + "Copy" text button (needed for the download fallback anyway). |

### Button rules (fixes DX-25, DX-26)

1. **One primary per screen** = the action that moves the user forward (Approve, Continue, Save, Retry, Get started).
2. **Secondary** = a real alternative to the primary (Download instead, Edit caption, Replace photo, Connect Instagram on step 4).
3. **Text button** = leaving, cancelling, going back, or optional: Back to Today, Cancel, Keep the post, Skip tour, Sign out.
4. **Danger** = destroying data (see DX-27).
5. Order on mobile, top to bottom: primary → secondary → text. Desktop: same order, primary on the right when in a row.

## Accessibility

- **Colour contrast:** `ink` on white ✅ ~16:1. `muted` #64708A on white ✅ ~4.9:1, but **fails on the pink part of the gradient** for 12–14 px text (DX-40, 🟡) → on gradient screens put body text on white cards, or use `ink` at 80% for paragraph text. `blue` on white ✅ ~6.2:1. White on `blue` ✅.
- **Touch targets:** buttons 44–52 ✅. Upload "×" 20 px ❌ (DX-13). Mobile nav items 48 ✅.
- **Text readability:** 12 px eyebrow text and "Illustrative" notes are small; eyebrows are fine at 12/16 medium uppercase, but no paragraph text below 14 px (DX-41, 🟢).
- **Alt text:** slides have no visible alt plan in Figma → use `slides[].alt` from the data (NFR-10). Owner photos: `"{product name}, your original photo"`.
- **State not by colour alone:** "Real product" badge has ✓ + text ✅; failed states must have an icon + text, not only red (DX-42, 🟢).

## What works well

- One clear decision per screen; every outcome (published, failed, skipped, download) has a next action.
- Calm palette lets the product photo carry the screen; the blue primary is unmistakable.
- Copy is warm and honest ("Nothing was published", "Download complete does not mean published") — keep that tone.
- Trust is built in: "Your approval always matters", Product check before/after, agent activity.
- 360 px QA frames and a reduced-motion landing exist.

## Priority order

1. **DX-20–24 one shell** (desktop sidebar everywhere, one mobile header + nav). Every screen depends on it, so build it first.
2. **DX-01 + DX-02 + DX-04** — one-tap approve and no prototype buttons. These directly affect the demo and the SRD promise.
3. **DX-25–28 button rules + DX-03 input style** — encode them in `Button` and `Field` once, and every screen gets them for free.
4. **DX-15 landing content** — needed for FR-LP-01 acceptance.
5. Everything else while slicing each screen.

---

`DESIGN.md` (tokens, layout, components) and `DECISIONS.md` (FD-17, FD-18) are already updated to match this file.

# Marken — frontend slicing handoff

Updated 2026-11-02. This document describes the current design handoff, not a working backend.

## Current architecture — one page per tab

This revision supersedes older separate-detail-screen guidance below. Build five application pages: Today, Products, Results, Settings and Agent activity. Mobile navigation has five text links (Activity is the short label); desktop uses the existing sidebar. Preserve one application shell per page.

Detail editing, comparisons, sharing, confirmations, loading and errors are states within the owning tab, not standalone application routes. Figma frames named `Panel / Mobile|Desktop / ...` are supporting overlay/swap specimens; they intentionally omit the application sidebar/header/navigation. Keep their trigger page visible behind the panel. Close restores focus to the trigger and preserves scroll, selected product and draft state. Use accessible dialogs for blocking confirmations, drawers/panels for editing, and inline skeleton/status regions for routine loading. Do not implement every loading specimen as a modal.

Onboarding, landing and authentication remain separate views. Onboarding upload/preparation remains part of its step flow. Historical QA specimens, sample-product screens and archives are reference variants, not extra routes. Slide 2/3 specimens represent carousel state inside Today, not separate pages or modal routes. Activity technical details expand within Agent activity.

Canonical Agent activity nodes: mobile `97:478`, desktop `97:520`. Main page IDs elsewhere in this document remain unchanged; converted detail node IDs also remain valid but now refer to panels. Some copied-page cross-feature links remain Figma URLs: use the canonical prototype to review navigation, and implement app state rather than those URLs.

## Start here

[Figma file](https://www.figma.com/design/9FeEf6cIQUwKkn8OsPAI7b/Untitled)

Use **00 Prototype — Complete app** (`96:146`) as the canonical source for screens and navigation. Feature pages contain organized copies: **01 Today**, **02 Products**, **03 Results**, **04 Settings**, **05 Start & onboarding**. Use **06 Wireframes — Connected flows** to understand journeys. Visual-direction, component-study and archived pages are references, not additional application routes.

Useful source nodes (mobile / desktop):

| Screen | Node IDs |
| --- | --- |
| Landing | `97:1922` / `97:1945` |
| Login | `97:1972` / `97:1992` |
| Company setup | `97:2058` / `97:2097` |
| Product upload | `97:2142` / `97:2179` |
| Today | `97:146` / `97:198` |
| Products | `97:255` / `97:287` |
| Results | `97:324` / `97:362` |
| Settings | `97:405` / `97:439` |
| Post generation | `97:989` / `97:1020` |
| Download complete | `98:1342` / `98:1366` |

With Figma MCP, inspect the node tree, variables and components, then obtain design context and screenshots for each screen. Follow your installed Figma design-to-code skill before calling `get_design_context`. Read the current file; older generated scripts and route JSON files are historical aids and do not include every later loading state or layout repair. If a feature copy disagrees with its source, use the canonical source and record the discrepancy.

## Build reusable layouts, not screen-sized images

- Primary specimens: 390 px mobile and 1440 px desktop. Narrow checks exist at 360 and 1280 px. Implement fluid behavior across 360–1440 px; intermediate/tablet behavior is not fully specified in Figma.
- Desktop app shell: horizontal layout, **224 px sidebar**, remaining width for header and content. Keep the sidebar and main content siblings. Never put the sidebar inside a vertical content stack. Use `minmax(0, 1fr)` or `min-width: 0` for main content.
- Desktop login/email: separate **400 px authentication panel**, flush to the left/top/bottom, and flexible form area. Do not reuse the 224 px app-sidebar width here.
- Mobile web app: header and product selector, then a 64 px horizontal text-first navigation row, then page content. Today, Products, Results and Settings use actual route links with aria-current="page". The former bottom dock has been removed. Keep the header/tabs in normal flow initially; if making them sticky, test browser chrome, keyboard and anchor offsets. Full-height Figma screens describe content, not browser viewport height.
- Cards and sections grow with content. Avoid fixed text-container heights. Allow text wrapping and test long product names, validation messages and localized copy.
- Keep normal document scrolling. Avoid nested scroll regions except intentional carousels/dialogs. Full content and shadows are intentionally visible on the design canvas.
- Typical spacing: 24 px mobile content top, 32 px bottom; 20–24 px card padding; 24–28 px major-block gaps. Landing features use 48 px vertical padding on mobile and 64 px on desktop. Follow individual inspected values where intentionally different.

Extract shared components for AppShell, AuthShell, navigation, product switcher, buttons, labeled fields, cards, loading panels, alerts, dialogs, post previews and platform selection. Preserve existing Figma instances where useful. Many text and card layers still have local overrides; consolidate these into code tokens instead of copying every value independently.

## Brand and assets

- Sidebar and login buttons: approximately **#213D8C** (`rgb(33,61,140)`). Mobile web navigation uses frosted white glass with blue controls. Blue and white dominate; pink is an accent.
- Mobile web navigation: frosted white glass rgba(255,255,255,.84), 20 px backdrop blur, 1 px white border at 90% opacity and soft shadow. Navigation labels use Inter Bold (font-weight: 700) in both active and inactive states. Blue inactive icons/labels (#2E52A6); active tab translucent blue with fully opaque dark-navy icons/labels (#112154). Keep square outer corners and the 64 px tab row below the header. Keep touch targets at least 44 px and provide focus and selected-state semantics.

```css
.mobile-web-nav {
  background: #ffffff; /* opaque fallback */
  border: 1px solid rgb(255 255 255 / 90%);
  box-sizing: border-box;
  border-radius: 0;
  box-shadow: 0 -2px 16px rgb(26 46 92 / 9%);
}
@supports ((backdrop-filter: blur(20px)) or (-webkit-backdrop-filter: blur(20px))) {
  .mobile-web-nav {
    background: rgb(255 255 255 / 84%);
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
  }
}
@media (prefers-reduced-transparency: reduce) {
  .mobile-web-nav {
    background: #ffffff;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
```

Apply alpha to the background colors, not to the whole navigation element. This keeps icons and labels opaque. Validate text contrast over both light and dark scrolling content. No bottom-dock spacer is required. Keep normal page-bottom padding and safe-area handling. If tabs become sticky, verify the glass effect and contrast over scrolling content.
- Marken wordmark uses small blue/pink offset accents. Implement as accessible text/SVG or a static asset, with one accessible name; do not announce decorative copies.
- Photo corners are restrained, generally 5–8 px on landing panels. Landing carousel panels are tilted; Figma uses a 2D approximation, not a complete 3D implementation specification.
- Export presets: image assets at 2× PNG, named vectors at SVG, screen references at 1× PNG. Screen PNGs are references only. Export source images and icons, not buttons/text/forms as raster UI.
- Preserve image aspect ratios and deliberate crops. Do not stretch images. Product examples and performance charts are illustrative, not real customer metrics.
- Use gradients, shadows and simple effects in CSS when practical. Check contrast; the visual audit is not a WCAG certification.

## Routes and behavior

Translate Figma links into application routes/state transitions. Cross-page Figma URL actions are handoff/prototype navigation, not website routes. Do not link app controls to figma.com.

Keep Today, Products, Results and Settings scoped to the selected product. Company details are entered before product setup. Instagram and Facebook publishing choices are distinct. Google Trends and TikTok Creative Center supply trend research; they are not publishing destinations. Google/Meta login and social-account publishing permissions require real OAuth/backend integration.

Landing has three example carousel states with a configured 3.2-second prototype delay. Implement swipe, category controls, pause/resume, keyboard access and reduced-motion behavior. Do not autoplay when reduced motion is requested; pause appropriately when focused/hovered or off-screen. Product/service categories are examples, not restrictions.

## Loading, completion and failure

| Loading operation | Mobile / desktop source nodes |
| --- | --- |
| Uploading images | `270:513` / `270:578` |
| Preparing cutouts | `270:661` / `270:726` |
| Regenerating background | `270:809` / `270:874` |
| Preparing captions | `270:957` / `270:1022` |
| Refreshing results | `270:1105` / `270:1170` |

These are screen-level loading specimens containing reusable skeleton panels. Prefer panel-level pending states when only one panel is fetching; retain surrounding context and existing data. A file picker comes before upload progress. Advance on actual operation completion, never a hard-coded success timer. Render real progress only if available; otherwise use an indeterminate indicator. Disable duplicate submissions, preserve previous results/drafts, expose errors and safe retry, and announce status with `aria-live`/`aria-busy`.

**Do not ship “View result · prototype” or “View recovery · prototype” buttons.** They demonstrate alternate states in Figma. Some recovery destinations are shared generic errors and need operation-specific messages in implementation. The prototype does not prove cancellation, background persistence, OAuth, downloads or publishing work.

## Scope and unresolved decisions

- Current landing copy explicitly supports products or services per the latest direction. Existing SRD and most onboarding designs remain product-photo/cutout based. Confirm the service workflow and backend support before creating service-specific fields or promising cutout behavior for services.
- Validate backend contracts, upload limits, job statuses, regeneration quotas, platform permissions and metrics availability against the SRD/API. Do not infer API contracts from placeholder UI copy.
- Results and image regeneration have P1 context in the historical SRD audit; confirm release sequencing without removing their designed routes.
- Tablet breakpoints, hover/focus/disabled coverage and complete typography-token binding still need implementation decisions and review.
- Figma presentation-device settings were not verified. Use the actual frame dimensions and browser testing, not prototype presentation scale, as implementation guidance.

## Final QA before shipping

Test 360, 390, tablet, 1280 and 1440 widths; no horizontal page overflow. Check desktop sidebar/main sibling alignment, mobile header/tab placement and safe areas, full-content scrolling, dropdown/dialog placement, long text and empty/error/loading/success states. Test keyboard navigation, focus restoration, contrast and reduced motion. Confirm product switching updates every feature, publishing requires approval, download does not imply publication, and metrics are never invented.

## Latest design repair

The audit found 23 desktop screens/copies with an incorrect vertical wrapper around sidebar and content. They were repaired to a horizontal shell, with fixed 224 px sidebars and intended screen widths. Oversized result empty-state cards and sample-product buttons were also corrected. Representative screenshots were reviewed; structural scans are not a guarantee that every pixel or live interaction has been validated.


### Landing decorative accents
Below the hero, use subtle white-to-pink background washes on the how-it-works introduction and review section. Keep other sections visually distinct. Decorative elements are separate and sparse: a pink curved stroke near the product-library section bottom and a single outline star in the sharing section. Do not repeat a star-and-glow cluster on every section. Treat accents as aria-hidden and pointer-events: none, scaled down on mobile and clear of content. Match Accent / Pink curved stroke and Accent / Single outline star in Figma.






### Active-tab textured glass
The selected mobile web tab now uses a blue glass gradient, 12 px backdrop blur, a thin white edge, inset pale-blue reflections, and very fine grain. The Figma layer Glass / Edge refraction and grain is an editable visual approximation of refraction, not physical lens distortion. Reproduce with layered CSS gradients and a low-opacity noise texture on a pointer-events:none, aria-hidden pseudo-element below the icon and bold label. Active highlights have 12 px rounded corners and a blue gradient at 35–42% opacity. Keep labels and icons fully opaque dark navy (#112154) for contrast; do not lower the opacity of the whole tab. The outer bar geometry stays unchanged. Use an opaque blue fallback when transparency is reduced. Do not animate the grain. The white-glass bar itself remains unchanged.



### Mobile navigation revision
All application screens now use Navigation / Mobile web tabs below the header, with 44 px touch targets inside a 64 px row. Labels are Inter Bold 12 px; redundant icons are hidden for a compact web layout. Keep the current rounded translucent glass active highlight. These are page navigation links, not ARIA tab widgets. Desktop sidebars are unchanged. Test browser Back/Forward, direct URLs, refresh and keyboard focus. Do not implement the historical fixed bottom bar described in earlier versions of this handoff.


### Landing footer
All landing states have Footer / Site information: wordmark, short description, How it works anchor, Sign in, Privacy policy, Terms of use and copyright. Use a semantic footer and navigation with 44 px link targets. Stack links on mobile and arrange horizontally on desktop. How it works scrolls to the feature introduction; Sign in goes to the app login route. Privacy and Terms are design placeholders without destinations: provide approved legal pages and actual routes before release. Do not invent legal text or ship dead links. Use the current year dynamically in the implementation.



## Interaction repair verification — 2026-11-02

The latest audit checked 1,814 internal links and found no missing destinations, self-navigation actions, panel-opening Figma URL links, oversized panel roots, or unintended horizontal container overflow. Intentional horizontal navigation/carousel viewports are excluded from overflow errors.

- Dialog specimens now cap at 740 px mobile / 760 px desktop. The 48 px Close row remains outside the vertically scrolling body. This is an intentional clipping exception: only scroll viewports mask content; cards and shadows remain visible. In code use a responsive max-height such as min(740px, calc(100dvh - 32px)), with focus trapping, Escape, focus restoration and scroll-lock tested in the browser.
- Mobile navigation labels are 13 px bold, with 88 px targets in a horizontally scrollable row. Ensure the active route scrolls into view in production and supports keyboard navigation. Activity now has a selected-state highlight.
- Today slide controls scroll an inline carousel. The old slide2/slide3 helper panels remain source references, not separate app routes.
- Inline operation component sets provide Ready, Loading, Complete and Error variants for caption preparation, scene regeneration, results refresh and product upload actions. The 2-second loading-to-complete transition is solely a Figma demo. Error is a separate review variant with retry. Production must use actual request/job state; do not copy the timer or display simulated success. Existing content remains in place while the control is pending.
- Cross-feature panel specimens are copied locally where necessary to preserve an overlay chain. The canonical complete prototype remains authoritative; local copies are supporting handoff assets.
- Today Skip now opens skip confirmation, not caption editing.
- Browser focus handling, file-picker behavior, real request cancellation and API errors remain frontend integration work; structural Figma checks do not validate these runtime behaviors.

## Native sharing in Today (4 November 2026)

- Open **Share your post** below the caption. This expands inside Today; it is not a new route.
- **01 Copy caption** uses the current caption choice plus hashtags. If clipboard access fails, a selectable read-only caption appears.
- **02 Prepare slides** fetches the original signed image files, preserving slide order and bytes. It makes no model or publishing calls.
- **03 Share images** opens the real device share sheet on a fresh tap. Instagram/Facebook selectors change instructions only; the device decides which apps support the supplied files. Captions are copied separately because target apps may ignore shared text.
- Per-slide downloads remain available even when sharing is unsupported or fails. Refresh Today if signed links expire. History's existing download controls remain unchanged.
- Canceling is harmless. A completed share handoff is not proof of publication and never changes post status. Failed-fidelity slides are not offered.
- Native file sharing needs a supported browser and a secure context. To test on a phone, use an HTTPS deployment; a desktop's LAN HTTP address is not sufficient. Check the real Instagram/Facebook targets on both iOS and Android before release.

Implementation: `SharePost`, `src/lib/sharing/native.ts`, and `ReviewPanel`. No new dependencies or credentials are required for the sharing flow.

Figma: Today sharing panels in **00 Prototype — Complete app** and **01 Today**; full mobile handoff reference `372:775`. Preserve the existing blue/white palette, subtle pink atmosphere, Inter typography, 28px platform SVGs, and numbered steps. Do not imitate the OS share sheet in app UI.

## Analytics demo

Results is now **Analytics** (`/analytics`); legacy `/results` bookmarks redirect. Demo mode shows three fixed sample LUMI posts, a seven-day reach chart with an accessible data table, engagement breakdown, sample orders and per-post context. All values and chart points are derived from `src/lib/mock/analytics.ts`. Post and platform filters use those same fixtures. Demo dates are fixed and visible; do not relabel them as the current week. Reach is summed across posts and must not be described as unique people. My account mode shows the unconnected state until real analytics collection is implemented. Never associate these sample outcomes with a user's generated posts.

## Dedicated loading

Reuse `CookingScreen` for server/page fallbacks and replace-screen processing states; use `CookingOverlay` for pending work over forms so drafts stay mounted. Both render the same `CookingContent` illustration, built from the existing Marken four-point vector. Exact copy: **Marken is cooking...**. Motion is a 1.8-second orbit followed by a 0.6-second hold, repeating only during real work. Preserve reduced-motion behavior. `NavigationLoading` belongs inside a Next Link and uses `useLinkStatus`; do not add timeouts to keep completed navigation on a loading screen. Shared ButtonLink, Logo, app navigation and SubmitButton already include pending handling. Async job generation keeps polling and offers progress details and a route back to History. Figma Mobile `393:561` / Desktop `393:574` are the visual source.

**Loading scope amendment:** Use the dedicated cooking loader ONLY for landing-page buttons (`ButtonLink showLoading`), image generation in the new-post flow, and existing-product switching. Other forms and route fallbacks retain normal loading feedback. No global navigation or form-submit cooking overlay. This supersedes the broader trigger list above.

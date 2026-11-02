# Marken — frontend slicing handoff

Updated 2026-11-02. This document describes the current design handoff, not a working backend.

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
- Mobile app: header, content, bottom navigation. In implementation, keep navigation visible and reserve its height plus safe-area inset so content cannot hide behind it. Full-height Figma canvas screens are content references, not literal browser viewport heights.
- Cards and sections grow with content. Avoid fixed text-container heights. Allow text wrapping and test long product names, validation messages and localized copy.
- Keep normal document scrolling. Avoid nested scroll regions except intentional carousels/dialogs. Full content and shadows are intentionally visible on the design canvas.
- Typical spacing: 24 px mobile content top, 32 px bottom; 20–24 px card padding; 24–28 px major-block gaps. Landing features use 48 px vertical padding on mobile and 64 px on desktop. Follow individual inspected values where intentionally different.

Extract shared components for AppShell, AuthShell, navigation, product switcher, buttons, labeled fields, cards, loading panels, alerts, dialogs, post previews and platform selection. Preserve existing Figma instances where useful. Many text and card layers still have local overrides; consolidate these into code tokens instead of copying every value independently.

## Brand and assets

- Sidebar and login buttons: approximately **#213D8C** (`rgb(33,61,140)`). Mobile bottom navigation uses a translucent glass variation of this blue. Blue and white dominate; pink is an accent.
- Mobile bottom-bar glass: blue gradient from `rgba(51,84,171,.88)` to `rgba(33,61,140,.82)`, 20 px background blur, 1 px inside white border at 26% opacity, and a soft shadow. Active tabs use white at 20% opacity with an 18% white border; labels/icons remain white. Preserve existing bar dimensions, rounding and safe-area clearance. Provide keyboard focus and selected-state semantics in code.

```css
.mobile-bottom-nav {
  background: #213d8c; /* opaque fallback */
  border: 1px solid rgb(255 255 255 / 26%);
  box-sizing: border-box;
  box-shadow: 0 6px 20px rgb(13 26 69 / 18%);
}
@supports ((backdrop-filter: blur(20px)) or (-webkit-backdrop-filter: blur(20px))) {
  .mobile-bottom-nav {
    background: linear-gradient(180deg, rgb(51 84 171 / 88%), rgb(33 61 140 / 82%));
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
  }
}
@media (prefers-reduced-transparency: reduce) {
  .mobile-bottom-nav {
    background: #213d8c;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
```

Apply alpha to the background colors, not to the whole navigation element. This keeps icons and labels opaque. Validate text contrast over both light and dark scrolling content. The bar's blur is most visible when content passes underneath it; keep enough bottom content padding to prevent obscuring the last action.
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

Test 360, 390, tablet, 1280 and 1440 widths; no horizontal page overflow. Check desktop sidebar/main sibling alignment, mobile safe-area navigation, full-content scrolling, dropdown/dialog placement, long text and empty/error/loading/success states. Test keyboard navigation, focus restoration, contrast and reduced motion. Confirm product switching updates every feature, publishing requires approval, download does not imply publication, and metrics are never invented.

## Latest design repair

The audit found 23 desktop screens/copies with an incorrect vertical wrapper around sidebar and content. They were repaired to a horizontal shell, with fixed 224 px sidebars and intended screen widths. Oversized result empty-state cards and sample-product buttons were also corrected. Representative screenshots were reviewed; structural scans are not a guarantee that every pixel or live interaction has been validated.

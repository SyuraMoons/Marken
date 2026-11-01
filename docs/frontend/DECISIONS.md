# MARKEN Frontend — Decisions

Short log. One decision per entry; add new ones at the bottom, never rewrite old ones (mark them *Replaced by FD-xx*).

---

**FD-01 · Design source is Figma page "05 Full app — SRD v2" (`96:146`).**
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

**FD-11 · Responsive shell switches at `lg` (1024 px).**
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

**FD-17 · Figma inconsistencies are fixed in code, not in Figma.**
`DESIGN_FIXES.md` lists them (`DX-xx`) and overrides the frames. Order of truth: SRD → DESIGN_FIXES → Figma.

**FD-18 · Approve is one tap from Today.**
The `approve` confirm frame is only used as the "Instagram not connected → download" choice (DX-01, US-04).

# MARKEN Frontend — Rules

For everyone (human or agent) working in the frontend workstream: Nalen & Akhnaf.
Read with: `docs/SRD.md` (source of truth) · `DESIGN.md` · `DESIGN_FIXES.md` · `DECISIONS.md` · `API_CONTRACT.md`.

---

## 1. Scope — what we own

Ours: `src/app/page.tsx`, `src/app/login/**`, `src/app/onboarding/**`, `src/app/(app)/**`, `src/components/**`, `src/lib/i18n/**`, `src/lib/mock/**`, `messages/**`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/manifest.ts`.

Not ours (read, don't edit; ask the owner): `src/app/api/**`, `src/proxy.ts`, `src/lib/supabase/**`, `src/lib/jobs/**`, `src/lib/instagram/**`, `src/lib/notify/**` (Harfi) · `src/lib/gateway/**`, `src/lib/agents/**`, `src/lib/studio/**` (Altaf).

Exception: `src/app/login/actions.ts` (auth logic) belongs to Harfi; we only style `login/page.tsx`.

## 2. Guardrails (never break)

1. **Nothing publishes without Approve.** The only publish trigger is the Approve button → `POST /api/posts/:id/approve`.
2. **Never show a redrawn product.** The before/after view shows the owner's original photo vs the composited slide. Don't crop, filter or upscale product images with CSS beyond `object-fit`.
3. **Real product badge only from data** (all slides `fidelity_passed`).
4. **No invented prices or claims** in UI copy or mock data shown as real.
5. **Every slide has alt text** (`slides[].alt`) (NFR-10).
6. Results are shown honestly: failed and skipped states are real screens, not hidden.

## 3. Code style

- TypeScript strict. No `any`. Use the generated DB types (`Tables<"posts">`), don't redeclare.
- **Comments: one short `//` line only, and only for the *why*.** No JSDoc blocks, no banner comments.
- Server Components first; `"use client"` only where needed (FD-07).
- Tailwind classes with design tokens only (`text-ink`, `bg-blue`). No inline `style`, no hex.
- Reuse `src/components/` (Button, Card, ...) — don't restyle a button inline.
- All UI strings in `messages/en.json`, read with `t()`. Keys are `area.thing` (`today.approve`).
- Keep files small; one component per file in `src/components/`, named export, kebab-case filename (`real-product-badge.tsx`).
- No new dependencies without team agreement (FD-10).
- Next.js 16: read `node_modules/next/dist/docs/` before using an API you are unsure of. `params`/`searchParams` are Promises; dynamic data needs `Suspense` or `generateStaticParams` (`cacheComponents` is on).

## 4. Accessibility and mobile (NFR-01, 09, 10)

- Works at 360 px with no horizontal scroll; check 360, 390, 1280, 1440.
- Tap targets ≥ 44 px. AA contrast (don't put `muted` text on `pink`).
- Real `<button>` / `<a>` elements, visible focus ring, labels on every input.
- Respect `prefers-reduced-motion`.
- Today must load fast (< 2 s on 4G): images via `next/image` with sizes, no client-side data waterfalls.

## 5. Slicing workflow (per screen)

1. Pick the screen from the map in `DESIGN.md` §5 (page `96:146` only), and check `DESIGN_FIXES.md` for every `DX-xx` that touches it.
2. Pull its design context from Figma (Mobile + Desktop frame). Map every value to an existing token; if a value is new, add the token to `globals.css` + `DESIGN.md` in the same PR.
3. Build with shared components, typed mock data, real status logic.
4. Check 360 px, 1440 px, keyboard, reduced motion.
5. `pnpm lint && pnpm build && pnpm typecheck` must pass.

## 6. Git

- Branch from `development`: `feat/fe-<slug>` (e.g. `feat/fe-today`). PR into `development`, fill the PR template, link the issue (`Closes #..`).
- Small PRs: one screen or one component set per PR.
- Commits: conventional (`feat(today): add carousel`), authored by the developer only — **no co-author or AI attribution lines**.
- Never push to `main`.

## 7. Done means

- Matches Figma at 390 and 1440, holds at 360.
- Every post state the screen can be in has its UI (FR-TD-04).
- Uses tokens + shared components, strings in `en.json`.
- CI green. SRD IDs listed in the PR.

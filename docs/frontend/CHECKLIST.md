# MARKEN Frontend — Progress Checklist

Updated by whoever slices a screen. States: ✅ done+verified · 🟡 sliced, not verified · ⬜ not started · ⛔ blocked on someone else

## Rules & docs
- ✅ Read SRD v2.0, AGENTS.md, TEAM.md; order of truth SRD → DESIGN_FIXES → Figma `96:146` (never Archive `0:1`)
- ✅ Doc audit: API_CONTRACT auth section corrected (not built yet), DESIGN §4 built-vs-planned components
- ✅ Tokens, Inter, light theme (`globals.css`, `layout.tsx`)

## Screens
- ✅ Shell: `Button`, `AppShell`/`AppNav` (mobile bar + desktop sidebar), `SetupShell` (5 steps)
- ✅ Today `/today` — every post status, mock data
- ✅ Landing `/` — DX-04, DX-14, DX-15 (both mobile + desktop layout); lint/build/typecheck pass, visual check done
- ✅ Login `/login` — DX-03, `?sent=1` + `?error=` states, styling only; lint/build/typecheck pass, visual check done
- ✅ Onboarding `/onboarding/1..5` — shop basics, upload 3–10, review + cutout confirm, voice & IG, first post + tour; lint/build/typecheck pass, visual check done
- ✅ Products `/products` — grid, add/check/edit/delete flows; lint/build/typecheck pass, visual check done
- ✅ Settings `/settings` — `ListRow` rows, shop/brand/instagram/reminders/account/delete sub-views; lint/build/typecheck pass, visual check done
- ✅ Edit caption `/posts/[id]/edit` — manual edit, option picker, rewrite-from-feedback (max 5), Approve with caption; lint/build/typecheck pass, visual check done
- ⬜ Results `/results` — P1, stays placeholder until after 2 Nov gate

## Not ours / waiting
- ⛔ Auth logic (Google, magic link, `login/actions.ts`, `proxy.ts`) — Harfi
- ⛔ API routes still 501 (approve/skip/extract/generate…) — Harfi; `GET /api/posts/:id/activity` doesn't exist yet
- ⛔ Live Figma frame check per screen (RULES §5) — no Figma access in this setup yet

## Verification
- ✅ `pnpm lint && pnpm build && pnpm typecheck` (1 Nov, all pass)
- ✅ Visual check at 360 px and 1440 px — code-level audit done (widths, tap targets ≥44px, contrast, reduced motion; carousel smooth-scroll fixed), browser eyeball done by Nalen (1 Nov)
- ⬜ No commit/push until Nalen says "push" (solo commits, no AI attribution)

# MARKEN Frontend — Progress Checklist

Updated by whoever slices a screen. States: ✅ done+verified · 🟡 sliced, not verified · ⬜ not started · ⛔ blocked on someone else

## Rules & docs
- ✅ Read SRD v2.0, AGENTS.md, TEAM.md; order of truth SRD → DESIGN_FIXES → Figma `96:146` (never Archive `0:1`)
- ✅ Doc audit: API_CONTRACT auth section corrected (not built yet), DESIGN §4 built-vs-planned components
- ✅ Tokens, Inter, light theme (`globals.css`, `layout.tsx`)

## Screens (Figma page 96:146, sections 01-10)

Mobile node IDs; every screen also has a Desktop frame (verified on Today only). ✅ done+verified · 🟡 built but partial/different/unverified · ⬜ not built · ➖ intentionally different · ⛔ blocked

### 01 Main app
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| today | 97:146 | `/today` | ✅ |
| products | 97:255 | `/products` | ✅ |
| results [P1] | 97:324 | `/results` | ✅ verified by Nalen (FD-19: team permission 1 Nov, typed mocks) |
| settings | 97:405 | `/settings` | ✅ |

### 02 Review & trust
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| slide2, slide3 | 98:650, 98:759 | `Carousel` states in Today | ✅ |
| activity | 97:478 | `/today?view=activity` full page from the post (DX-11) | 🟡 built, unverified |
| compare | 97:567 | `/today?view=compare` full page, badge-gated (FR-FD-03) | 🟡 built, unverified |
| edit | 97:636 | `/posts/[id]/edit` | ✅ |
| caption-alt | 97:2676 | Option 1/2 cards + “Use this caption” + “Edit manually” in `ReviewPanel` picker | 🟡 built, unverified |
| fidelity-failed | 97:2937 | Today `failed` + bad slide, no Approve | ✅ |
| image-edit [P1] | 97:1427 | slide remake in `/posts/[id]/edit` (FR-ED-05), re-check gates Approve | 🟡 built, unverified |

### 03 Approve & publish
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| approve | 97:715 | one-tap Approve instead of confirm screen (FD-18) | ➖ |
| download | 97:845 | `DownloadFlow` when IG not connected | ✅ |
| downloaded | 98:1340 | `DownloadFlow` ready state | ✅ verified by Nalen |
| generating | 97:989 | Today `generating` + AutoRefresh | ✅ |
| publishing | 97:2749 | Today `approved`/`publishing` | ✅ |
| published | 97:782 | Today `published` | ✅ |
| failed | 97:1056 | Today `failed` + Retry | ✅ |
| skip | 97:920 | skip chips in `ReviewPanel` | ✅ |
| skipped | 97:2816 | Today `skipped` | ✅ |

### 04 Products
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| product-add | 97:1222 | `ProductsView` | ✅ |
| product-check | 98:1040 | cutout check in `ProductsView` | ✅ |
| product-edit | 97:1121 | name, category, price, currency, attributes, description in `ProductsView` form | 🟡 fields built, unverified |
| product-delete | 98:1431 | `ProductsView` | ✅ |
| product-error | 98:1538 | `UploadError` | ✅ verified by Nalen |

### 05 Results [P1]
| Screen | Node | Status |
| :--- | :--- | :--- |
| result-detail | 97:1295 | ✅ verified by Nalen |
| learning | 97:1366 | ✅ verified by Nalen |

### 06 Settings
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| shop | 97:1498 | `SettingsView` | ✅ |
| brand | 97:1579 | `SettingsView` (tone + up to 10 rules + sample) | ✅ |
| instagram | 97:1650 | `SettingsView` | ✅ |
| connected | 98:1287 | `SettingsView` connected state | ✅ |
| reminders | 97:1707 | `SettingsView` | ✅ |
| account | 97:1782 | motion toggle done; `InstallMarken` unverified | 🟡 |
| delete | 97:1859 | `SettingsView` | ✅ (UI only, no backend route) |
| deleted | 98:1397 | `SettingsView` | ✅ (fake state) |

### 07 Start here
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| landing | 97:1922 | `/` | ✅ |
| landing-compare | 98:1488 | inline before/after on `/` (CTA = Get started, DX-04) | ✅ |
| login | 97:1972 | `/login` (styling only, auth is Harfi's) | ✅ |
| email | 97:2016 | `/login?sent=1` with “Resend link” + “Use another email” | 🟡 built, unverified |

### 08 Guided setup (steps 1-3)
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| setup-shop | 97:2058 | `/onboarding/1` | ✅ |
| setup-upload | 97:2142 | `/onboarding/2` | ✅ |
| upload-error | 97:2873 | `UploadError` in step 2 | ✅ verified by Nalen |
| setup-review (+review2, review3) | 97:2222, 98:868, 98:954 | `/onboarding/3` cutout confirm | ✅ |
| setup-details | 98:1119 | currency, attributes, description added in setup step 3 cards | 🟡 fields built, unverified |

### 09 Voice + Instagram (step 4)
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| setup-voice | 97:2308 | `/onboarding/4` | ✅ |
| setup-connected | 98:1227 | `/onboarding/4` after connect | ✅ |

### 10 First post + tour (step 5)
| Screen | Node | Where | Status |
| :--- | :--- | :--- | :--- |
| tour | 97:2396 | 3 coach marks over a labelled sample post | ✅ verified by Nalen |
| tour-fidelity | 97:2466 | mark 2 expands the before/after pair + failed-check example card | ✅ verified by Nalen |
| tour-activity | 97:2542 | mark 3 shows the real `ActivityPanel` steps list | ✅ verified by Nalen |
| resume | 97:2638 | `/onboarding/resume` | ✅ |

### Across all screens
- 🟡 Save and exit (setup shell, all 5 steps) — PATCH `/api/shops/:id/onboarding` is live, unverified end to end
- ⬜ PWA icons 192/512 px (NFR-08) — need the logo from Nalen. `favicon.ico` restored, so the manifest icon works again until real icons are added
- ⬜ "AI assisted" slide label (NFR-20) — wording and placement need Nalen's decision
- ⬜ Desktop frame check for every screen except Today (53 desktop frames)
- ⬜ Live side-by-side Figma pass per screen (RULES §5)
- 🟡 Live data: Today, Edit, Products, Settings and Onboarding are wired (#34). Results, its detail and learning screens, and the tour sample post still use `src/lib/mock`. Slide remake (image-edit) needs the regenerate route to accept `target: "slide"` and shows an error until then

### Summary (1 Nov)
50 screens: done 41 · built but unverified 8 · intentionally different 1 · not built 0. The missing-states work was merged with `development` (live data) in the `feat/fe-missing-states` PR.

## Not ours / waiting
- ✅ Auth, API routes and activity route live on `development`; Today, edit, products, settings and onboarding read and write real data
- ⛔ Instagram connect (`/api/auth/instagram/callback` still 501) and the generate/regenerate/publish jobs — Harfi
- ⛔ Resume screen is built but nothing sends owners to it: `src/proxy.ts` redirects unfinished setups straight to `/onboarding/N` — Harfi
- ⛔ Live Figma frame check per screen (RULES §5) — no Figma access in this setup yet
- ⛔ Login "Resend link" (Figma 97:2016) — needs the email kept server-side after the redirect; removed rather than faked

## Verification
- ✅ `pnpm lint`, `pnpm build`, `pnpm typecheck` all pass (1 Nov, after motion-preference lint fix in `settings-view.tsx`)
- ✅ Visual check at 360 px and 1440 px — code-level audit done (widths, tap targets ≥44px, contrast, reduced motion; carousel smooth-scroll fixed), browser eyeball done by Nalen (1 Nov)
- ⬜ Push only when Nalen says "push" (solo commits, no AI attribution)

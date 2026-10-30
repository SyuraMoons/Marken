## Summary
<!-- Briefly describe what this PR implements or fixes -->

Closes #<!-- Issue number -->

## SRD v2.0 Reference
- **Feature / Requirement ID(s):** `F-xx` / `FR-xx-xx`
- **Target Branch:** Make sure base branch is `development` (unless promoting a milestone to `main`).

## Guardrails Checklist (SRD v2.0)
- [ ] `pnpm lint`, `pnpm build`, and `pnpm typecheck` pass locally
- [ ] All model calls go through `src/lib/gateway/index.ts` (`FR-CL-01`)
- [ ] Product pixels are never passed through a generative model (`FR-CG-09`)
- [ ] Nothing publishes without owner Approve (`FR-TD-02`)

# Refinement plan

## Goal

Complete the core journey without changing the stack or turning the MVP into a marketplace:

Material Discovery -> Product Intelligence -> Feasibility -> Cost -> Buyer Intelligence -> Actual Outcome

## Work plan

| Priority | Current implementation | Target behavior | Files and modules | Acceptance criteria |
|---|---|---|---|---|
| P0 | Outcome collection reserved in rules only | A saved opportunity records actual production, material balance, costs, sales and revenue | `src/domain/outcomes`, outcome repo/service/API, opportunity detail UI | Actuals persist separately from estimates; all arithmetic is deterministic and tested |
| P0 | Material deletion only removes material and photo metadata | Delete the complete material aggregate | `src/server/repos/materials.ts` | No jobs, opportunities, feasibility, cost or outcomes remain for the deleted material |
| P1 | Discovery replacement removes all prior opportunities | Preserve selected historical work | `src/server/repos/opportunities.ts` | Saved opportunities survive a discovery rerun; unsaved recommendations are replaced |
| P1 | Documentation marks outcomes deferred | Align audit, architecture and data model with implementation | `docs/*` | Documentation describes actual behavior and limitations |
| P1 | Existing domain scenario ends at buyer matching | Extend scenario through an actual result | `tests/domain/*` | Plywood scenario produces tested actual cost, revenue, margin and sell-through |

## Dependencies and sequencing

1. Define and test pure outcome arithmetic.
2. Add validated request schema and tenant-scoped persistence.
3. Add service orchestration with saved-opportunity and material guards.
4. Add idempotent API and audit event.
5. Add responsive UI to the opportunity detail page.
6. Repair deletion and rediscovery lifecycle behavior.
7. Declare and deploy the Firestore index.
8. Run typecheck, lint, tests and production build.
9. Review the complete workflow and document residual risks.

## Non-goals

- No marketplace, payments, RFQs or guaranteed buyer claims.
- No graph database.
- No general CAD or irregular-shape optimizer.
- No automatic material-ledger mutation until reversal semantics are defined.
- No forced major dependency upgrade in the same production change.
- No live Gemini billing without explicit key and budget approval.

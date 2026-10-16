# Refinement report

Report date: 16 October 2026

## Retained

- Next.js, React, TypeScript, Tailwind, Firebase and Gemini-compatible architecture.
- Existing visual identity, Manrope typography, mascot and responsive application shell.
- Human-confirmed material provenance and uncertainty communication.
- Catalogue-bound recommendations, deterministic feasibility, cost, market and buyer logic.
- Firebase session, tenant isolation, private uploads, rate limits and audit events.

## Improved

- Material deletion now removes its bounded aggregate rather than leaving orphan documents.
- Discovery replacement preserves saved opportunities and their historical outcomes.
- Data model and product requirements now describe implemented outcome tracking.
- The realistic plywood scenario now continues from estimate to a tested actual result.

## Added

- Pure production outcome engine for total cost, gross result, gross margin, per-unit actuals and
  sell-through.
- Schema-validated, idempotent outcome API with tenant isolation and audit logging.
- Firestore repository and composite index for opportunity outcome history.
- Responsive actual-outcome form and history table on saved opportunity details.
- Product audit and refinement plan.

## Architectural choices

- Actuals are append-only records and never overwrite estimates.
- The outcome snapshots product name, currency, material unit and key estimate values so historical
  reporting does not change when current assumptions change.
- Only saved opportunities accept outcomes. This prevents accidental records against discarded
  recommendations.
- All financial arithmetic remains outside AI.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: 15 files passed, 195 tests passed, 1 explicitly skipped.
- `npm run build`: passed with Next.js 15.5.28; 17 static pages generated and the new
  `/api/opportunities/[id]/outcomes` route included.
- `tests/domain/outcomes.test.ts`: 3 focused arithmetic tests passed.
- Firestore and Storage rules validated and published successfully.
- The `production_outcomes` composite index was created in the production project.
- `gemini-3.5-flash-lite` was checked against current official Google model documentation and is a
  valid multimodal model with structured-output support. Live usage remains disabled.

## Known limitations and deferred work

- Production uses the clearly labelled mock AI adapter until a Gemini key is provisioned.
- Outcome corrections and reversals are not yet implemented.
- Recording an outcome does not automatically decrement material availability.
- Repository and route integration tests need Firebase emulator coverage.
- Transitive dependency advisories requiring major upgrades remain a separate migration.
- HTTPS certificate provisioning for `resaikel.web.id` is managed asynchronously by Google Cloud.

## Remaining risks

- The outcome index must be deployed before production reads can query outcome history.
- Live Gemini behavior needs a real-photo acceptance test after secret provisioning.
- Major framework and Firebase upgrades need their own compatibility and visual-regression pass.

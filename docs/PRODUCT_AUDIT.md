# Product audit

Audit date: 16 October 2026

## Executive assessment

Resaikel is not a prototype made from disconnected screens. Its core is a well-separated
Next.js application where AI proposes, Zod validates, and pure TypeScript engines decide
geometry, yield, cost, evidence quality and ranking. The primary journey was already usable
through cost and buyer intelligence. The missing link was actual outcome tracking, plus two
data-lifecycle defects around deletion and discovery replacement. Those issues are addressed in
this refinement.

Production currently runs with `AI_MODE=mock`. The live Gemini adapter exists, but real photo
interpretation is not enabled until a Gemini key and an explicit cost decision are supplied.
The interface correctly labels mock results and does not imply that a model was called.

## Existing capabilities

### Material discovery

- Multi-photo upload with browser compression and server-side byte validation.
- Plywood, MDF, cardboard and a broader material taxonomy.
- Dimensions, thickness, quantity, condition, contamination, defects, origin and notes.
- Per-field provenance using `ai`, `user`, `measured` or `unknown`.
- Human confirmation is mandatory for critical physical attributes.
- Saved inventory, photo metadata, cached analysis jobs and resumable analysis status.

### AI product intelligence

- Gemini-compatible multimodal analysis and catalogue-bound candidate generation.
- Deterministic offline adapter for development and zero-cost production staging.
- Schema-validated JSON, timeout, retry, repair attempts, prompt-injection boundaries and
  unsupported measurement claim detection.
- Curated parametric product templates, with concept-only ideas clearly separated from validated
  templates.

### Feasibility, cost and market

- Rectangular 2D nesting with kerf, rotations, capacity and waste calculation.
- Ordered feasibility gates for verified material, family, dimensions, thickness, condition,
  capacity and workshop capability.
- Editable deterministic cost assumptions with integer money arithmetic.
- Market price bands derived only from labelled evidence.
- Buyer segments are marked hypothetical unless backed by a consented registered requirement.
- Ranking recomputes when cost changes.

### Platform and UX

- Firebase Auth session cookies and server-side organization membership checks.
- Firestore tenant isolation, private Storage paths, rate limiting and audit events.
- Responsive marketing, material, opportunity and workspace flows with consistent design tokens.
- Accessible labels, semantic tables, focusable controls, feedback states and mobile breakpoints.
- Cloud Run deployment through keyless GitHub OIDC.

## Findings and priority

| Priority | Finding | Status |
|---|---|---|
| P0 | Material deletion did not cascade beyond photo records, leaving analysis and evaluation documents orphaned despite documentation claiming otherwise. | Fixed |
| P0 | Production had no Material to Product to Outcome continuation. `production_outcomes` existed only in rules. | Fixed |
| P1 | Discovery replacement deleted saved opportunities. This could destroy the selected product anchor needed by outcome history. | Fixed |
| P1 | Live Gemini is configured in code but production intentionally remains in mock mode and has no secret version. | Deferred pending API key and cost approval |
| P1 | Firestore emulator integration tests for repositories, rules and route handlers are absent. Pure engines are well tested, but persistence continuity is not automatically exercised end to end. | Deferred |
| P1 | Actual material availability is recorded in each outcome but is not automatically decremented. Automatic mutation needs a clear policy for partial sheets, reversals and corrections. | Deferred |
| P1 | An outcome cannot yet be edited or voided. Append-only recording is safer than silent overwrite, but corrections need an explicit reversal workflow. | Deferred |
| P2 | Product catalogue breadth is intentionally limited. More templates require manufacturing review, not AI generation. | Deferred |
| P2 | No verified buyer marketplace, RFQ or transaction layer exists. Current buyer intelligence is positioning and consented demand only. | Correctly scoped |
| P2 | Advanced nesting, irregular geometry, CAD export and multi-workshop planning are outside the MVP. | Correctly scoped |

## Incorrect or disconnected workflows found

1. Deleting a material removed only the material document and up to 20 photo documents. Related
   jobs, opportunities, feasibility results and cost estimates survived. The implementation now
   deletes the complete aggregate in safe Firestore batch chunks after Storage objects are removed.
2. Running discovery with replacement removed saved opportunities. Replacement now removes only
   disposable unsaved recommendations, preserving selected work and its actual outcomes.
3. The product stopped at a saved opportunity. A saved opportunity can now record production date,
   quantity made and sold, material consumed, remaining material, waste, cost lines, revenue and
   notes. Derived actual margins remain separate from estimates.

## Architecture and security concerns

- Production dependency advisories remain in transitive Firebase and Next.js trees. The available
  npm remediation requires major upgrades. A compatibility update reduced the count, but major
  upgrades should be tested in a dedicated change rather than forced into a deployment.
- The asynchronous analysis worker uses Next.js `after()` and transactional reclaim. This is
  appropriate for the current load, but Cloud Tasks is the next step if jobs exceed request-runtime
  guarantees.
- The new outcome list requires the declared Firestore composite index to be deployed before the
  UI is used in production.
- Live AI must use Secret Manager and Cloud Run service identity. No browser-exposed Gemini key is
  acceptable.
- Workalaw was observed to contain plaintext credentials in Cloud Run environment variables during
  infrastructure comparison. Those credentials should be rotated and migrated to Secret Manager;
  no values are reproduced here.

## Recommended next improvements

### P0

- Deploy the `production_outcomes` index and verify the new workflow against Firebase emulators or
  a dedicated staging organization.

### P1

- Add repository and route integration tests using Auth, Firestore and Storage emulators.
- Design outcome correction as append-only reversal plus replacement, preserving auditability.
- Define and implement a material-ledger policy before automatically changing available quantity.
- Enable Gemini only after key provisioning, quota limits, budget alerts and a live-photo acceptance
  run are approved.

### P2

- Add reviewed product templates based on real workshop processes.
- Add evidence ingestion and verification workflows before claiming buyer matching.
- Consider richer cutting optimization only after rectangular stock proves insufficient.

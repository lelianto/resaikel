# Competition readiness audit — AI Builders Cup 2026

Theme: **Sustainability & Circular Economy**
Audit date: 17 October 2026
Verified against: the working tree at the time of audit (not just the docs).

## What was verified, not trusted

| Check | Command | Result |
|---|---|---|
| Unit + contract tests | `npm test` | **196 passed, 1 skipped** (15 files, 3.1s) |
| Type safety | `tsc --noEmit` | Clean |
| Lint | `eslint .` | Clean |
| Architecture claims | manual read of `src/domain`, `src/ai`, docs | Consistent with documentation |

The engineering substance behind the README is real: a pure, framework-free domain
layer, a disciplined "AI proposes, deterministic code decides" pipeline, Zod contracts,
tenant isolation, and honest uncertainty handling. This is a strong foundation — the gaps
below are about **winning a sustainability competition**, not about code quality.

## Readiness scorecard (estimated, against typical AI-builder axes)

Replace this with the official rubric once available; the mapping below is a placeholder.

| Axis | Score | One-line reason |
|---|---|---|
| Theme fit — circular economy | 4 / 5 | Core concept nails reuse-to-product; but impact is never quantified or shown. |
| Innovation / originality | 4 / 5 | "AI proposes, engines decide" + an explicit anti-greenwashing stance is a genuine differentiator. |
| Technical execution | 5 / 5 | Clean separation, 196 tests, green typecheck/lint/build, real auth, tenancy, security. |
| **Impact & measurability** | **2.5 / 5** | **The central gap.** The product deliberately shows no circularity numbers. |
| Use of AI | 4 / 5 | Real multimodal pipeline with strong guardrails — but docs contradict themselves on live vs mock. |
| Demo / pitch readiness | 3 / 5 | Excellent marketing site; no quantified "wow" payoff; demo-mode story is unclear. |

## Findings, by priority

### P0 — Make circular-economy impact visible (highest leverage)

> **Status (17 Oct 2026): built.** An authenticated Impact / Circularity report now
> lives at `/circularity` (nav label "Impact"), backed by a pure `aggregateCircularity`
> engine over `production_outcomes` with 7 dedicated tests. It needs **no new Firestore
> index** (single-field `orgId` query). Remaining for a live demo: seed a demo org with a
> couple of completed outcomes so judges see populated figures instead of the empty state
> (see P1 below).

The theme is literally *circular economy*, and the one thing the product refuses to show is
**circularity outcomes**. The `/impact` page lists *what could be measured* but renders **no
actual figures**. Meanwhile the data to compute defensible metrics already exists in
`production_outcomes` and the nesting engine.

Build an **Impact / Circularity dashboard** that aggregates data you already hold — all of it
"measured, never guessed", so it stays fully consistent with the product's ethic:

- Total material reused — sheet area and unit count from **completed** outcomes.
- Waste diverted — material consumed by completed production records (a real reuse event,
  not a projection).
- Cutting-waste ratio — already produced by the deterministic guillotine nesting engine.
- Sell-through and gross result — already computed by the outcome engine.

This turns the existing honesty discipline from a *liability* in a sustainability pitch into
its headline: **"every number here is backed by a completed reuse record."**

Optional, still defensible: a landfill-diversion figure (kg) for completed outcomes only,
using published material densities with the method shown on screen. Keep **carbon** out
unless you adopt a *cited* emission factor (e.g. a published kg-CO₂e per kg of plywood /
cardboard) and display the methodology — a sourced factor would *strengthen* the pitch, not
violate the "no unvalidated claims" rule.

### P1 — Resolve the live-vs-mock AI contradiction before judging

- Latest commit is `feat: enable live Gemini pipeline` and `.env.local` has `GEMINI_API_KEY`
  set, but `docs/PRODUCT_AUDIT.md`, `docs/REFINEMENT_REPORT.md` and `docs/AI_PIPELINE.md`
  still state production runs in **mock mode**. A judge reading the docs will conclude the AI
  is fake. Update the docs to state the current mode, or decide the demo mode deliberately.
- Run a real-photo acceptance pass (the `tests/ai/real-photos.test.ts` suite has 1 skipped
  case) so a live demo cannot surprise you.

### P1 — Build a demo that ends in the payoff

The seeded plywood scenario (`src/domain/demo`) is good but stops at process. Seed a demo
org whose completed outcomes populate the new Impact dashboard, so the judge sees the full
loop — photo → confirmed material → product → **completed reuse → measured impact** — not just
the machinery. The offline mock adapter is an asset here: a zero-cost, always-works demo that
never depends on network or quota during judging.

### P2 — Depth items (mention as roadmap, not blockers)

- Outcome correction / reversal workflow (currently append-only, no void).
- Material-ledger auto-decrement policy (partial sheets, reversals).
- Firebase emulator integration tests for repositories, rules and route handlers.
  **Partially closed (17 Oct 2026):** `tests/integration/outcomes-flow.test.ts` now
  exercises the save-opportunity → record-outcome → read-back → aggregate-impact chain
  through the real services and repositories, with Firestore replaced by an in-memory
  fake (`tests/support/fake-firestore.ts`) so it runs without the emulator. This proves
  the application code wires together; **security rules and composite indexes still need
  the emulator** and remain unproven in CI.
- Transitive dependency advisories pending a major-upgrade migration.

## Strengths to lean into during the pitch

- **Integrity as a feature.** Most sustainability entries inflate impact; resaikel refuses to.
  Pair that stance with the P0 measured metrics and it becomes a trust story, not a gap.
- **Explainable money** — eleven cost lines, integer minor units, every figure shows its working.
- **Consent-aware buyer matching** — a privacy-respecting demand signal.
- **Deterministic offline mode** — the demo cannot break mid-presentation.

## Suggested 1-week plan to "layak"

1. Impact dashboard over existing `production_outcomes` data (P0).
2. Reconcile AI-mode docs + one live real-photo run (P1).
3. Seeded end-to-end demo org ending in a populated Impact dashboard (P1).
4. A sourced, optional landfill-diversion figure with visible methodology (P0 stretch).
5. Pitch framing: integrity + measured circularity, roadmap for P2 items.

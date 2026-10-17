# Verifying Firestore rules and indexes locally

The pure engines and the service wiring are covered by `npm test`. Two things it
cannot cover run outside that suite, because they need a real Firestore backend:

1. **Security rules** (`firestore.rules`) — tenant isolation and write lockout.
2. **Composite indexes** (`firestore.indexes.json`) — the emulator ignores them,
   so only a real project reveals a missing one.

This document is the runbook for both.

## Prerequisites

- Java runtime (for the Firestore emulator).
- `npm install` has been run (adds `@firebase/rules-unit-testing`).

## A. Security rules

The rules tests run against the **real emulator** — the in-memory fake used by the
service tests cannot evaluate `firestore.rules`.

```bash
npm run emulators
```

```bash
npm run test:rules
```

`tests/rules/firestore-rules.test.ts` asserts the two guarantees the rules exist
for:

- **Tenant isolation** — an active member reads only their own org's `materials`,
  `product_opportunities`, `production_outcomes`, `cost_estimates`; a member of
  another org, an unauthenticated client, and an *inactive* membership are all
  denied.
- **Write lockout** — every domain collection is server-written, so no client
  write is allowed. The only client-writable document is the user's own profile.
- Shared reference data (`product_templates`) is readable by any signed-in user
  but not by guests; server-internal collections (`audit_events`) are never
  exposed.

Add a case here whenever a new collection or access path is introduced.

## B. Composite indexes

The Firestore emulator does **not** enforce composite indexes: a query that would
fail in production succeeds locally. The authoritative check runs every query
shape the app uses against a real, index-enforcing project:

```bash
# read-only, one document per query, safe against production
GOOGLE_APPLICATION_CREDENTIALS=sa.json \
  FIREBASE_PROJECT_ID=resaikel-prod \
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false \
  node --import tsx scripts/check-indexes.ts
```

Any query lacking an index prints `INDEX` plus the Firestore console URL that
creates the exact index when opened. Then mirror it into `firestore.indexes.json`
and deploy so it is reproducible:

```bash
firebase deploy --only firestore:indexes
```

Run `npm run check:indexes` against the emulator only as a smoke test of the
script itself; it will report everything as passing regardless.

### Static audit (17 Oct 2026)

Cross-checking every composite query in `src/server/repos` against
`firestore.indexes.json`. Queries with a single equality filter and no `orderBy`
need no composite index and are omitted.

| Query (repo) | Matching index in file? |
|---|---|
| materials by org, newest first | ✅ |
| materials by org + status, newest first | ✅ |
| material_photos by material, ordered | ✅ |
| opportunities saved, newest saved first | ✅ |
| opportunities by org, ranked | ✅ |
| production_outcomes by opportunity, newest first | ✅ |
| production_outcomes by org (impact report) | ✅ single-field, none needed |
| cost_estimates by opportunity, newest first | ✅ |
| feasibility_results by opportunity | ✅ (prefix) |
| **opportunities by material, ranked** | ⚠️ not in file |
| **buyer_requirements matchable** (array-contains + consent) | ⚠️ not in file |
| **buyer_requirements by org, newest first** | ⚠️ not in file |
| **analysis_jobs by input hash** | ⚠️ not in file |
| **analysis_jobs cached succeeded** | ⚠️ not in file |
| **analysis_jobs by material, newest first** | ⚠️ not in file |

The ⚠️ rows have no matching index in `firestore.indexes.json`. They are **not
confirmed bugs**: the production project may already carry these indexes created
directly in the console (the refinement report notes the `production_outcomes`
index was created that way). `npm run check:indexes` against the live project is
what settles it. If one is genuinely missing, add it — the candidate definitions:

```jsonc
// product_opportunities
{ "fields": [
  { "fieldPath": "orgId", "order": "ASCENDING" },
  { "fieldPath": "materialId", "order": "ASCENDING" },
  { "fieldPath": "rank", "order": "ASCENDING" } ] }

// buyer_requirements — matchable
{ "fields": [
  { "fieldPath": "productCategories", "arrayConfig": "CONTAINS" },
  { "fieldPath": "consentToMatch", "order": "ASCENDING" } ] }

// buyer_requirements — by org
{ "fields": [
  { "fieldPath": "orgId", "order": "ASCENDING" },
  { "fieldPath": "createdAt", "order": "DESCENDING" } ] }

// analysis_jobs — by input hash
{ "fields": [
  { "fieldPath": "orgId", "order": "ASCENDING" },
  { "fieldPath": "materialId", "order": "ASCENDING" },
  { "fieldPath": "inputHash", "order": "ASCENDING" },
  { "fieldPath": "createdAt", "order": "DESCENDING" } ] }

// analysis_jobs — cached succeeded
{ "fields": [
  { "fieldPath": "orgId", "order": "ASCENDING" },
  { "fieldPath": "type", "order": "ASCENDING" },
  { "fieldPath": "inputHash", "order": "ASCENDING" },
  { "fieldPath": "status", "order": "ASCENDING" },
  { "fieldPath": "createdAt", "order": "DESCENDING" } ] }

// analysis_jobs — by material
{ "fields": [
  { "fieldPath": "orgId", "order": "ASCENDING" },
  { "fieldPath": "materialId", "order": "ASCENDING" },
  { "fieldPath": "createdAt", "order": "DESCENDING" } ] }
```

Each entry also needs `"collectionGroup"` and `"queryScope": "COLLECTION"`, matching
the existing entries in the file.

## What this still does not cover

- Storage rules (`storage.rules`) have no automated test yet.
- Route-handler authz (session cookie → org membership) is exercised by the
  service-level test with an in-memory Firestore, not against the emulator.

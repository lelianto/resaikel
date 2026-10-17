/**
 * Composite-index checker.
 *
 * The Firestore emulator does NOT enforce composite indexes, so a query that
 * would fail in production succeeds locally. The only reliable check is to run
 * every distinct query shape the app uses against a real, index-enforcing
 * Firestore project and see which ones raise FAILED_PRECONDITION.
 *
 *   # against a real project (authoritative — needs credentials)
 *   GOOGLE_APPLICATION_CREDENTIALS=sa.json \
 *     FIREBASE_PROJECT_ID=resaikel-prod \
 *     NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false \
 *     node --import tsx scripts/check-indexes.ts
 *
 * Every query is read-only and capped at one document, so it is safe to run
 * against production. A missing index is reported with the console URL Firestore
 * returns, which creates the exact index when opened.
 */

import { adminDb, COLLECTIONS } from '../src/server/firebase/admin';
import { isEmulatorMode } from '../src/lib/config';

interface Probe {
  readonly name: string;
  readonly build: () => FirebaseFirestore.Query;
}

const db = adminDb();

const PROBES: Probe[] = [
  {
    name: 'materials by org, newest first',
    build: () =>
      db.collection(COLLECTIONS.materials).where('orgId', '==', 'x').orderBy('createdAt', 'desc'),
  },
  {
    name: 'materials by org + status, newest first',
    build: () =>
      db
        .collection(COLLECTIONS.materials)
        .where('orgId', '==', 'x')
        .where('status', '==', 'verified')
        .orderBy('createdAt', 'desc'),
  },
  {
    name: 'material_photos by material, ordered',
    build: () =>
      db
        .collection(COLLECTIONS.materialPhotos)
        .where('orgId', '==', 'x')
        .where('materialId', '==', 'm')
        .orderBy('order', 'asc'),
  },
  {
    name: 'opportunities saved, newest saved first',
    build: () =>
      db
        .collection(COLLECTIONS.productOpportunities)
        .where('orgId', '==', 'x')
        .where('saved', '==', true)
        .orderBy('savedAt', 'desc'),
  },
  {
    name: 'opportunities by org, ranked',
    build: () =>
      db
        .collection(COLLECTIONS.productOpportunities)
        .where('orgId', '==', 'x')
        .orderBy('rank', 'asc')
        .orderBy('createdAt', 'desc'),
  },
  {
    name: 'opportunities by material, ranked',
    build: () =>
      db
        .collection(COLLECTIONS.productOpportunities)
        .where('orgId', '==', 'x')
        .where('materialId', '==', 'm')
        .orderBy('rank', 'asc'),
  },
  {
    name: 'production_outcomes by opportunity, newest first',
    build: () =>
      db
        .collection(COLLECTIONS.productionOutcomes)
        .where('orgId', '==', 'x')
        .where('opportunityId', '==', 'o')
        .orderBy('occurredAt', 'desc'),
  },
  {
    name: 'production_outcomes by org (impact report)',
    build: () => db.collection(COLLECTIONS.productionOutcomes).where('orgId', '==', 'x'),
  },
  {
    name: 'cost_estimates by opportunity, newest first',
    build: () =>
      db
        .collection(COLLECTIONS.costEstimates)
        .where('orgId', '==', 'x')
        .where('opportunityId', '==', 'o')
        .orderBy('computedAt', 'desc'),
  },
  {
    name: 'buyer_requirements matchable (array-contains + consent)',
    build: () =>
      db
        .collection(COLLECTIONS.buyerRequirements)
        .where('productCategories', 'array-contains', 'storage')
        .where('consentToMatch', '==', true),
  },
  {
    name: 'buyer_requirements by org, newest first',
    build: () =>
      db
        .collection(COLLECTIONS.buyerRequirements)
        .where('orgId', '==', 'x')
        .orderBy('createdAt', 'desc'),
  },
  {
    name: 'analysis_jobs by input hash',
    build: () =>
      db
        .collection(COLLECTIONS.analysisJobs)
        .where('orgId', '==', 'x')
        .where('materialId', '==', 'm')
        .where('inputHash', '==', 'h')
        .orderBy('createdAt', 'desc'),
  },
  {
    name: 'analysis_jobs cached succeeded',
    build: () =>
      db
        .collection(COLLECTIONS.analysisJobs)
        .where('orgId', '==', 'x')
        .where('type', '==', 'material_analysis')
        .where('inputHash', '==', 'h')
        .where('status', '==', 'succeeded')
        .orderBy('createdAt', 'desc'),
  },
  {
    name: 'analysis_jobs by material, newest first',
    build: () =>
      db
        .collection(COLLECTIONS.analysisJobs)
        .where('orgId', '==', 'x')
        .where('materialId', '==', 'm')
        .orderBy('createdAt', 'desc'),
  },
  {
    name: 'feasibility_results by opportunity',
    build: () =>
      db
        .collection(COLLECTIONS.feasibilityResults)
        .where('orgId', '==', 'x')
        .where('opportunityId', '==', 'o'),
  },
];

function missingIndexMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (/requires an index|FAILED_PRECONDITION/i.test(message)) return message;
  return null;
}

async function main(): Promise<void> {
  if (isEmulatorMode) {
    console.warn(
      '\n! Running against the Firestore emulator, which does NOT enforce composite indexes.\n' +
        '  Every probe will pass here. Point this at a real project to get a meaningful result.\n',
    );
  }

  console.log('Checking composite-index coverage for every query shape the app uses\n');

  let missing = 0;
  for (const probe of PROBES) {
    try {
      await probe.build().limit(1).get();
      console.log(`  ok    ${probe.name}`);
    } catch (error) {
      const indexError = missingIndexMessage(error);
      if (indexError) {
        missing += 1;
        console.error(`  INDEX ${probe.name}`);
        console.error(`        ${indexError.replace(/\s+/g, ' ').trim()}`);
      } else {
        console.error(`  error ${probe.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  console.log(
    `\n${missing === 0 ? 'All probes passed.' : `${missing} query shape(s) need an index.`}`,
  );
  process.exit(missing === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('\nIndex check failed to run:', error instanceof Error ? error.message : error);
  process.exit(1);
});

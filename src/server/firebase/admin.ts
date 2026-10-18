import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

import { assertProductionEnv, emulatorConfig, isEmulatorMode, serverConfig } from '@/lib/config';

/**
 * Firebase Admin bootstrap.
 *
 * In emulator mode no credentials exist and none are needed: the SDK is pointed
 * at the local emulators via the `*_EMULATOR_HOST` environment variables. Those
 * must be set *before* any service is constructed, which is why this runs at
 * module scope.
 *
 * Outside emulator mode the service account is mandatory, and a missing variable
 * fails loudly here rather than silently denying every request later.
 */

if (isEmulatorMode) {
  process.env.FIRESTORE_EMULATOR_HOST ??= `${emulatorConfig.firestoreHost}:${emulatorConfig.firestorePort}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${emulatorConfig.authHost}:${emulatorConfig.authPort}`;
  // The Admin/Storage SDK wants host:port here with no protocol; a leading
  // `http://` makes newer @google-cloud/storage throw on the first request.
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= `${emulatorConfig.storageHost}:${emulatorConfig.storagePort}`;
}

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return getApp();

  if (isEmulatorMode) {
    return initializeApp({
      projectId: serverConfig.projectId,
      storageBucket: serverConfig.storageBucket,
    });
  }

  assertProductionEnv();

  const credential =
    serverConfig.clientEmail && serverConfig.privateKey
      ? cert({
          projectId: serverConfig.projectId,
          clientEmail: serverConfig.clientEmail,
          privateKey: serverConfig.privateKey,
        })
      : applicationDefault();

  return initializeApp({
    credential,
    projectId: serverConfig.projectId,
    storageBucket: serverConfig.storageBucket,
  });
}

// `getFirestore()` returns one instance per Admin app, shared process-wide, and
// `settings()` may be applied to it exactly once. Next's dev server and bundle
// splitting evaluate this module more than once, each with its own module-level
// cache, so the instance is cached on `globalThis` instead — that is the only
// state shared across those evaluations — and `settings()` is guarded so a second
// evaluation cannot call it again on the already-initialised instance.
const FIRESTORE_CACHE_KEY = Symbol.for('resaikel.adminFirestore');
type FirestoreGlobal = typeof globalThis & { [FIRESTORE_CACHE_KEY]?: Firestore };

export function adminDb(): Firestore {
  const store = globalThis as FirestoreGlobal;
  if (store[FIRESTORE_CACHE_KEY]) return store[FIRESTORE_CACHE_KEY];

  const db = getFirestore(adminApp());
  // Documents are built explicitly rather than spread from request bodies, but
  // this removes an entire class of runtime failure from optional fields.
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already initialised by an earlier module evaluation; the setting stands.
  }
  store[FIRESTORE_CACHE_KEY] = db;
  return db;
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminStorage(): Storage {
  return getStorage(adminApp());
}

export function adminBucket() {
  return adminStorage().bucket(serverConfig.storageBucket);
}

/** Firestore collection names, declared once so a typo cannot split a collection. */
export const COLLECTIONS = {
  users: 'users',
  organizations: 'organizations',
  organizationMembers: 'organization_members',
  workshops: 'workshops',
  workshopCapabilities: 'workshop_capabilities',
  materials: 'materials',
  materialPhotos: 'material_photos',
  productTemplates: 'product_templates',
  productComponents: 'product_components',
  analysisJobs: 'analysis_jobs',
  productOpportunities: 'product_opportunities',
  feasibilityResults: 'feasibility_results',
  costEstimates: 'cost_estimates',
  marketEvidence: 'market_evidence',
  buyerRequirements: 'buyer_requirements',
  productionOutcomes: 'production_outcomes',
  auditEvents: 'audit_events',
  rateLimits: 'rate_limits',
  idempotencyKeys: 'idempotency_keys',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

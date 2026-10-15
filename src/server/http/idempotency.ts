import { nowIso } from '@/domain/common';
import type { AuthContext } from '@/domain/identity/types';

import { adminDb, COLLECTIONS } from '../firebase/admin';
import { HttpError } from './errors';

/**
 * Idempotency for state-changing requests.
 *
 * A client that retries a POST because the response was lost must not create a
 * second material, or start a second paid analysis. The caller sends an
 * `Idempotency-Key`; the first request claims it, and any replay with the same
 * key and the same body receives the original response rather than doing the work
 * again.
 */

const KEY_TTL_MS = 24 * 60 * 60 * 1000;

interface IdempotencyRecord {
  readonly orgId: string;
  readonly uid: string;
  readonly key: string;
  readonly fingerprint: string;
  readonly response: unknown;
  readonly createdAt: string;
  readonly expiresAtMs: number;
}

function fingerprintOf(value: unknown): string {
  // Stable enough for replay detection: keys are sorted so key order cannot
  // change the fingerprint.
  const canonical = JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const entries = Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      return Object.fromEntries(entries);
    }
    return item;
  });

  let hash = 0;
  for (let index = 0; index < canonical.length; index += 1) {
    hash = (hash * 31 + canonical.charCodeAt(index)) | 0;
  }
  return `${canonical.length}:${hash}`;
}

export interface IdempotencyClaim {
  /** True when this call should do the work; false when replaying a result. */
  readonly fresh: boolean;
  readonly replayedResponse: unknown | null;
}

export async function claimIdempotencyKey(
  auth: AuthContext,
  key: string,
  body: unknown,
): Promise<IdempotencyClaim> {
  const db = adminDb();
  const documentId = `${auth.orgId}_${auth.uid}_${key}`;
  const ref = db.collection(COLLECTIONS.idempotencyKeys).doc(documentId);
  const fingerprint = fingerprintOf(body);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (snapshot.exists) {
      const existing = snapshot.data() as IdempotencyRecord;

      if (existing.expiresAtMs < Date.now()) {
        transaction.set(ref, {
          orgId: auth.orgId,
          uid: auth.uid,
          key,
          fingerprint,
          response: null,
          createdAt: nowIso(),
          expiresAtMs: Date.now() + KEY_TTL_MS,
        } satisfies IdempotencyRecord);
        return { fresh: true, replayedResponse: null };
      }

      if (existing.fingerprint !== fingerprint) {
        throw new HttpError(
          'IDEMPOTENCY_CONFLICT',
          'This idempotency key was already used with a different request body.',
        );
      }

      return { fresh: false, replayedResponse: existing.response };
    }

    transaction.set(ref, {
      orgId: auth.orgId,
      uid: auth.uid,
      key,
      fingerprint,
      response: null,
      createdAt: nowIso(),
      expiresAtMs: Date.now() + KEY_TTL_MS,
    } satisfies IdempotencyRecord);

    return { fresh: true, replayedResponse: null };
  });
}

/** Stores the response so a replay returns the same body rather than redoing work. */
export async function completeIdempotencyKey(
  auth: AuthContext,
  key: string,
  response: unknown,
): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.idempotencyKeys)
    .doc(`${auth.orgId}_${auth.uid}_${key}`)
    .set({ response, completedAt: nowIso() }, { merge: true });
}

/** Reads the key without claiming it - used by routes that are safe to repeat. */
export function idempotencyKeyFrom(request: Request): string | null {
  const value = request.headers.get('idempotency-key');
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 128) {
    throw new HttpError(
      'INVALID_INPUT',
      'The Idempotency-Key header must be between 8 and 128 characters.',
    );
  }
  return trimmed;
}

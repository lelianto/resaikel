import { nowIso } from '@/domain/common';
import type { AuthContext } from '@/domain/identity/types';
import { serverConfig } from '@/lib/config';

import { adminDb, COLLECTIONS } from '../firebase/admin';
import { HttpError } from './errors';

/**
 * Rate limiting and the daily AI allowance.
 *
 * A Firestore-backed fixed window: one counter document per (org, user, kind,
 * window). Fixed windows are coarse but cheap, with no extra infrastructure, and
 * they are enough to stop a runaway loop or a single account draining the AI
 * budget. The counter is incremented in a transaction so concurrent requests
 * cannot both slip under the limit.
 */

export type RateLimitKind = 'api' | 'ai' | 'upload';

function windowKeys(kind: RateLimitKind, now: Date): { window: string; ttlMs: number } {
  if (kind === 'ai') {
    // Daily allowance, resetting at UTC midnight.
    const window = now.toISOString().slice(0, 10);
    const endOfDay = Date.parse(`${window}T00:00:00.000Z`) + 86_400_000;
    return { window, ttlMs: endOfDay - now.getTime() };
  }

  // Per-minute sliding bucket for everything else.
  const window = now.toISOString().slice(0, 16);
  const endOfMinute = Date.parse(`${window}:00.000Z`) + 60_000;
  return { window, ttlMs: Math.max(1_000, endOfMinute - now.getTime()) };
}

function limitFor(kind: RateLimitKind): number {
  if (kind === 'ai') return serverConfig.ai.dailyQuotaPerUser;
  if (kind === 'upload') return 60;
  return serverConfig.rateLimit.requestsPerMinute;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly count: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAtMs: number;
}

export async function checkRateLimit(
  auth: AuthContext,
  kind: RateLimitKind,
): Promise<RateLimitResult> {
  const now = new Date();
  const { window, ttlMs } = windowKeys(kind, now);
  const limit = limitFor(kind);

  const db = adminDb();
  const ref = db
    .collection(COLLECTIONS.rateLimits)
    .doc(`${auth.orgId}_${auth.uid}_${kind}_${window}`);

  const count = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? (snapshot.data() as { count?: number }).count ?? 0 : 0;
    const next = current + 1;

    transaction.set(
      ref,
      {
        orgId: auth.orgId,
        uid: auth.uid,
        window,
        count: next,
        expiresAtMs: now.getTime() + ttlMs,
        updatedAt: nowIso(),
      },
      { merge: true },
    );

    return next;
  });

  return {
    allowed: count <= limit,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetAtMs: now.getTime() + ttlMs,
  };
}

export async function enforceRateLimit(
  auth: AuthContext,
  kind: RateLimitKind = 'api',
): Promise<RateLimitResult> {
  const result = await checkRateLimit(auth, kind);

  if (!result.allowed) {
    if (kind === 'ai') {
      throw new HttpError(
        'AI_QUOTA_EXCEEDED',
        `The daily AI allowance of ${result.limit} analyses has been used. It resets at midnight UTC.`,
        { details: { limit: result.limit, resetAtMs: result.resetAtMs } },
      );
    }

    throw new HttpError('RATE_LIMITED', 'Too many requests. Wait a moment and try again.', {
      details: { limit: result.limit, resetAtMs: result.resetAtMs },
    });
  }

  return result;
}

import type { MaterialAnalysis } from '@/ai/schemas';
import type { IsoDateTime } from '@/domain/common';
import type { Material, MaterialPhoto } from '@/domain/materials/types';

/**
 * Persisted document shapes.
 *
 * These are the exact objects written by the server. Reads cast to these types
 * without re-validating, which is deliberate: Firestore is not a trust boundary
 * for our own server writes. Untrusted input is validated at the API boundary
 * with Zod, and security rules stop a client writing any of these collections at
 * all.
 */

/**
 * A material as stored. Photographs live in `material_photos`, with a count and a
 * primary id denormalised here so an inventory list needs no secondary query.
 */
export interface MaterialDocument extends Omit<Material, 'photos'> {
  readonly photoCount: number;
  readonly primaryPhotoId: string | null;
}

export interface MaterialPhotoDocument extends MaterialPhoto {
  readonly schemaVersion: number;
}

export type AnalysisJobType = 'material_analysis';
export type AnalysisJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface AnalysisUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
}

export interface AnalysisJobError {
  readonly code: string;
  readonly message: string;
  readonly details: readonly string[];
}

export interface AnalysisJobDocument {
  readonly id: string;
  readonly orgId: string;
  readonly schemaVersion: number;
  readonly materialId: string;
  readonly type: AnalysisJobType;
  readonly status: AnalysisJobStatus;
  /**
   * Hash of everything that could change the answer. A job whose hash matches a
   * completed job is served from that result instead of calling the model again.
   */
  readonly inputHash: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly attempts: number;
  readonly validationAttempts: number;
  readonly claimedAt: IsoDateTime | null;
  readonly startedAt: IsoDateTime | null;
  readonly finishedAt: IsoDateTime | null;
  readonly output: MaterialAnalysis | null;
  readonly unsupportedClaims: readonly string[];
  readonly error: AnalysisJobError | null;
  readonly usage: AnalysisUsage;
  readonly mock: boolean;
  readonly createdBy: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface AuditEventDocument {
  readonly id: string;
  readonly orgId: string;
  readonly schemaVersion: number;
  readonly actorUid: string;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly createdAt: IsoDateTime;
}

export interface RateLimitDocument {
  readonly id: string;
  readonly orgId: string;
  readonly uid: string;
  readonly window: string;
  readonly count: number;
  readonly expiresAtMs: number;
  readonly updatedAt: IsoDateTime;
}

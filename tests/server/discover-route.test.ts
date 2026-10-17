import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeDb } from '../support/fake-firestore';

/**
 * End-to-end test of the discover route handler.
 *
 * It drives the real `POST` export through the `authedRoute` wrapper, so the
 * request-id envelope, the status guard and the supported-family gate all run.
 * Firestore is the in-memory fake; auth and the AI rate limiter are stubbed so
 * the test exercises the route's own logic rather than the session plumbing.
 */

vi.mock('@/server/firebase/admin', async () => {
  const actual = await vi.importActual<typeof import('@/server/firebase/admin')>(
    '@/server/firebase/admin',
  );
  return { ...actual, adminDb: () => fakeDb };
});

const AUTH = {
  uid: 'user-1',
  email: 'demo@resaikel.test',
  emailVerified: true,
  displayName: 'Demo',
  orgId: 'org-1',
  orgName: 'Demo Workshop',
  role: 'owner' as const,
  roles: [] as const,
  currency: 'IDR',
  country: 'ID',
  locale: 'id-ID',
  onboardingCompleted: true,
};

vi.mock('@/server/auth/guards', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/guards')>(
    '@/server/auth/guards',
  );
  return { ...actual, requireAuth: async () => AUTH, requireRole: () => undefined };
});

vi.mock('@/server/http/ratelimit', async () => {
  const actual = await vi.importActual<typeof import('@/server/http/ratelimit')>(
    '@/server/http/ratelimit',
  );
  return { ...actual, enforceRateLimit: async () => undefined };
});

const { COLLECTIONS } = await import('@/server/firebase/admin');
const { POST } = await import('@/app/api/materials/[id]/discover/route');

type DiscoverResponse = { error?: { code: string; details: Record<string, unknown> } };

function callDiscover(materialId: string) {
  const request = { json: async () => ({}) } as unknown as Parameters<typeof POST>[0];
  return POST(request, { params: Promise.resolve({ id: materialId }) });
}

function seedMaterial(id: string, overrides: Record<string, unknown> = {}): void {
  const timestamp = '2026-10-01T00:00:00.000Z';
  void fakeDb
    .collection(COLLECTIONS.materials)
    .doc(id)
    .set({
      orgId: 'org-1',
      schemaVersion: 1,
      createdBy: 'user-1',
      title: 'Broken glass panel',
      origin: null,
      notes: null,
      attributes: {
        category: 'glass',
        subtype: null,
        color: null,
        texture: null,
        shape: null,
        condition: 'good',
        contamination: [],
        defects: [],
      },
      quantity: { value: 2, unit: 'sheet' },
      dimensions: { lengthMm: 600, widthMm: 400, thicknessMm: 6 },
      provenance: {
        category: { source: 'user', recordedAt: timestamp },
        lengthMm: { source: 'measured', recordedAt: timestamp },
        widthMm: { source: 'measured', recordedAt: timestamp },
        quantity: { source: 'user', recordedAt: timestamp },
      },
      availability: { availableQuantity: 2, reservedQuantity: 0, usedQuantity: 0 },
      status: 'verified',
      photoCount: 0,
      primaryPhotoId: null,
      missingInformation: [],
      warnings: [],
      isSampleData: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      verifiedAt: timestamp,
      ...overrides,
    });
}

describe('POST /api/materials/:id/discover — supported-family gate', () => {
  beforeEach(() => {
    fakeDb.reset();
  });

  it('rejects a verified but unsupported material with MATERIAL_FAMILY_UNSUPPORTED', async () => {
    seedMaterial('mat-glass');

    const response = await callDiscover('mat-glass');
    const body = (await response.json()) as DiscoverResponse;

    expect(response.status).toBe(422);
    expect(body.error?.code).toBe('MATERIAL_FAMILY_UNSUPPORTED');
    expect(body.error?.details.family).toBe('glass');
    expect(body.error?.details.supportedFamilies).toEqual([
      'cardboard',
      'sheet_wood',
      'solid_wood',
    ]);

    // The gate blocks before any opportunity is written.
    expect(fakeDb.dump(COLLECTIONS.productOpportunities).size).toBe(0);
  });

  it('checks verification before the family gate', async () => {
    // An unconfirmed material fails on the earlier guard, not the family one, so
    // the user is told to confirm first rather than that the material is unsupported.
    seedMaterial('mat-draft', { status: 'needs_confirmation', verifiedAt: null });

    const response = await callDiscover('mat-draft');
    const body = (await response.json()) as DiscoverResponse;

    expect(response.status).toBe(422);
    expect(body.error?.code).toBe('MATERIAL_NOT_VERIFIED');
  });

  it('reports a missing material as not found', async () => {
    const response = await callDiscover('ghost');
    const body = (await response.json()) as DiscoverResponse;

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe('MATERIAL_NOT_FOUND');
  });
});

import { memberDocId } from '@/domain/ids';
import { nowIso, SCHEMA_VERSION, type Page } from '@/domain/common';
import type {
  Organization,
  OrganizationMember,
  OrgRole,
  UserProfile,
  UserRole,
} from '@/domain/identity/types';
import type { Workshop, WorkshopCapability } from '@/domain/workshop/types';

import { adminDb, COLLECTIONS } from '../firebase/admin';
import type { AuditEventDocument } from './types';

/**
 * Identity, organisation and workshop persistence.
 *
 * Every read that serves a tenant's data filters on the organisation id and
 * returns null on a mismatch, so a guessed document id cannot be used to read
 * another tenant's record - and importantly, it cannot be used to *discover* that
 * the record exists either.
 */

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  if (!snapshot.exists) return null;
  return { ...(snapshot.data() as Omit<UserProfile, 'id'>), id: snapshot.id };
}

export interface UpsertUserInput {
  readonly uid: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly displayName: string | null;
}

/** Creates the profile on first sign-in, and refreshes token-derived fields after. */
export async function upsertUserProfile(input: UpsertUserInput): Promise<UserProfile> {
  const db = adminDb();
  const ref = db.collection(COLLECTIONS.users).doc(input.uid);
  const existing = await ref.get();
  const timestamp = nowIso();

  if (!existing.exists) {
    const profile: Omit<UserProfile, 'id'> = {
      uid: input.uid,
      displayName: input.displayName,
      email: input.email,
      emailVerified: input.emailVerified,
      roles: [],
      defaultOrgId: null,
      lastSignedInAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: SCHEMA_VERSION,
    };
    await ref.set(profile);
    return { ...profile, id: input.uid };
  }

  const current = existing.data() as Omit<UserProfile, 'id'>;
  const patch: Partial<UserProfile> = {
    email: input.email ?? current.email,
    emailVerified: input.emailVerified || current.emailVerified,
    displayName: current.displayName ?? input.displayName,
    lastSignedInAt: timestamp,
    updatedAt: timestamp,
  };
  await ref.set(patch, { merge: true });

  return { ...current, ...patch, id: input.uid };
}

export async function updateUserProfile(
  uid: string,
  patch: Partial<Pick<UserProfile, 'roles' | 'defaultOrgId' | 'displayName'>>,
): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({ ...patch, updatedAt: nowIso() } satisfies Partial<UserProfile>, { merge: true });
}

export async function completeOnboarding(input: {
  readonly uid: string;
  readonly displayName: string | null;
  readonly roles: readonly UserRole[];
  readonly orgName: string;
  readonly country: string;
  readonly city: string | null;
  readonly currency: string;
  readonly locale: string;
}): Promise<{ organization: Organization; member: OrganizationMember }> {
  const db = adminDb();
  const timestamp = nowIso();

  const orgRef = db.collection(COLLECTIONS.organizations).doc();
  const organization: Omit<Organization, 'id'> = {
    name: input.orgName.trim(),
    country: input.country,
    city: input.city,
    currency: input.currency,
    locale: input.locale,
    createdBy: input.uid,
    onboardingCompletedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: SCHEMA_VERSION,
  };

  // The member document id is `<orgId>_<uid>` because the security rules resolve
  // membership with a single document read on exactly that path.
  const memberRef = db
    .collection(COLLECTIONS.organizationMembers)
    .doc(memberDocId(orgRef.id, input.uid));

  const member: OrganizationMember = {
    id: memberRef.id,
    orgId: orgRef.id,
    uid: input.uid,
    role: 'owner',
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const batch = db.batch();
  batch.set(orgRef, organization);
  batch.set(memberRef, member);
  batch.set(
    db.collection(COLLECTIONS.users).doc(input.uid),
    {
      roles: [...input.roles],
      defaultOrgId: orgRef.id,
      ...(input.displayName ? { displayName: input.displayName } : {}),
      updatedAt: timestamp,
    },
    { merge: true },
  );
  await batch.commit();

  return { organization: { ...organization, id: orgRef.id }, member };
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const snapshot = await adminDb().collection(COLLECTIONS.organizations).doc(orgId).get();
  if (!snapshot.exists) return null;
  return { ...(snapshot.data() as Omit<Organization, 'id'>), id: snapshot.id };
}

export async function updateOrganization(
  orgId: string,
  patch: Partial<
    Pick<Organization, 'name' | 'country' | 'city' | 'currency' | 'locale'>
  >,
): Promise<void> {
  await adminDb()
    .collection(COLLECTIONS.organizations)
    .doc(orgId)
    .set({ ...patch, updatedAt: nowIso() } satisfies Partial<Organization>, { merge: true });
}

export async function getMember(orgId: string, uid: string): Promise<OrganizationMember | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.organizationMembers)
    .doc(memberDocId(orgId, uid))
    .get();

  if (!snapshot.exists) return null;
  return { ...(snapshot.data() as Omit<OrganizationMember, 'id'>), id: snapshot.id };
}

export async function listMembers(orgId: string): Promise<OrganizationMember[]> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.organizationMembers)
    .where('orgId', '==', orgId)
    .limit(50)
    .get();

  return snapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<OrganizationMember, 'id'>),
    id: doc.id,
  }));
}

export async function addMember(
  orgId: string,
  uid: string,
  role: OrgRole,
): Promise<OrganizationMember> {
  const timestamp = nowIso();
  const ref = adminDb()
    .collection(COLLECTIONS.organizationMembers)
    .doc(memberDocId(orgId, uid));

  const member: OrganizationMember = {
    id: ref.id,
    orgId,
    uid,
    role,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await ref.set(member);
  return member;
}

// ------------------------------------------------------------------ workshops

export async function getWorkshopForOrg(orgId: string): Promise<Workshop | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.workshops)
    .where('orgId', '==', orgId)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) return null;
  return { ...(doc.data() as Omit<Workshop, 'id'>), id: doc.id };
}

export async function upsertWorkshop(input: {
  readonly orgId: string;
  readonly uid: string;
  readonly name: string;
  readonly city: string | null;
  readonly country: string;
  readonly capacityNote: string | null;
}): Promise<Workshop> {
  const db = adminDb();
  const existing = await getWorkshopForOrg(input.orgId);
  const timestamp = nowIso();

  if (existing) {
    const patch = {
      name: input.name,
      city: input.city,
      country: input.country,
      capacityNote: input.capacityNote,
      updatedAt: timestamp,
    };
    await db.collection(COLLECTIONS.workshops).doc(existing.id).set(patch, { merge: true });
    return { ...existing, ...patch };
  }

  const ref = db.collection(COLLECTIONS.workshops).doc();
  const workshop: Omit<Workshop, 'id'> = {
    orgId: input.orgId,
    name: input.name,
    city: input.city,
    country: input.country,
    capacityNote: input.capacityNote,
    createdBy: input.uid,
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: SCHEMA_VERSION,
  };
  await ref.set(workshop);
  return { ...workshop, id: ref.id };
}

export async function getWorkshopCapability(orgId: string): Promise<WorkshopCapability | null> {
  const snapshot = await adminDb()
    .collection(COLLECTIONS.workshopCapabilities)
    .where('orgId', '==', orgId)
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  if (!doc) return null;
  return { ...(doc.data() as Omit<WorkshopCapability, 'id'>), id: doc.id };
}

export async function upsertWorkshopCapability(input: {
  readonly orgId: string;
  readonly workshopId: string;
  readonly tools: readonly WorkshopCapability['tools'][number][];
  readonly processes: readonly WorkshopCapability['processes'][number][];
  readonly supportedFamilies: readonly WorkshopCapability['supportedFamilies'][number][];
  readonly defaultLabourRatePerHourMinor: number | null;
  readonly notes: string | null;
}): Promise<WorkshopCapability> {
  const db = adminDb();
  const existing = await getWorkshopCapability(input.orgId);
  const timestamp = nowIso();
  const ref = existing
    ? db.collection(COLLECTIONS.workshopCapabilities).doc(existing.id)
    : db.collection(COLLECTIONS.workshopCapabilities).doc();

  const capability: Omit<WorkshopCapability, 'id'> = {
    orgId: input.orgId,
    workshopId: input.workshopId,
    schemaVersion: SCHEMA_VERSION,
    tools: [...input.tools],
    processes: [...input.processes],
    supportedFamilies: [...input.supportedFamilies],
    defaultLabourRatePerHourMinor: input.defaultLabourRatePerHourMinor,
    notes: input.notes,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await ref.set(capability);
  return { ...capability, id: ref.id };
}

// ---------------------------------------------------------------------- audit

export async function recordAuditEvent(input: {
  readonly orgId: string;
  readonly actorUid: string;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly meta?: Record<string, unknown>;
}): Promise<void> {
  const db = adminDb();
  const event: Omit<AuditEventDocument, 'id'> = {
    orgId: input.orgId,
    schemaVersion: SCHEMA_VERSION,
    actorUid: input.actorUid,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    meta: input.meta ?? {},
    createdAt: nowIso(),
  };
  // Append-only. Failures here must never break the operation being audited.
  try {
    await db.collection(COLLECTIONS.auditEvents).add(event);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'warn',
        message: 'Failed to record an audit event',
        action: input.action,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export type { Page };

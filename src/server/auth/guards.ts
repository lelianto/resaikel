import { memberDocId } from '@/domain/ids';
import type {
  AuthContext,
  Organization,
  OrganizationMember,
  OrgRole,
  UserProfile,
  UserRole,
} from '@/domain/identity/types';
import { isEmulatorMode, serverConfig } from '@/lib/config';

import { adminDb, COLLECTIONS } from '../firebase/admin';
import { forbidden, unauthenticated } from '../http/errors';
import { readSession } from './session';

/**
 * Authorisation.
 *
 * The rule this file exists to enforce: the *server* decides what a user may do,
 * using the `organization_members` collection as the single source of truth.
 * Role information held in the browser is presentation only and is never trusted
 * here.
 */

export interface SessionUser {
  readonly uid: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly displayName: string | null;
  readonly roles: readonly UserRole[];
  readonly defaultOrgId: string | null;
}

function profileFromToken(
  uid: string,
  claims: Record<string, unknown>,
  stored: UserProfile | null,
): SessionUser {
  const tokenName = typeof claims['name'] === 'string' ? claims['name'] : null;
  const tokenEmail = typeof claims['email'] === 'string' ? claims['email'] : null;
  const tokenVerified = claims['email_verified'] === true;

  return {
    uid,
    email: stored?.email ?? tokenEmail,
    emailVerified: stored?.emailVerified ?? tokenVerified,
    displayName: stored?.displayName ?? tokenName,
    roles: stored?.roles ?? [],
    defaultOrgId: stored?.defaultOrgId ?? null,
  };
}

async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  if (!snapshot.exists) return null;
  return { ...(snapshot.data() as Omit<UserProfile, 'id'>), id: snapshot.id };
}

/**
 * Returns the signed-in user, or null. Does NOT require an organisation, so it is
 * safe to call from the onboarding flow.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const decoded = await readSession();
  if (!decoded) return null;

  const stored = await loadUserProfile(decoded.uid);
  return profileFromToken(decoded.uid, decoded as unknown as Record<string, unknown>, stored);
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthenticated();
  return user;
}

interface MembershipWithOrg {
  readonly member: OrganizationMember;
  readonly organization: Organization | null;
}

async function loadMembership(uid: string, orgId: string): Promise<MembershipWithOrg | null> {
  const db = adminDb();
  const memberSnapshot = await db
    .collection(COLLECTIONS.organizationMembers)
    .doc(memberDocId(orgId, uid))
    .get();

  if (!memberSnapshot.exists) return null;

  const member = {
    ...(memberSnapshot.data() as Omit<OrganizationMember, 'id'>),
    id: memberSnapshot.id,
  };
  if (member.status !== 'active') return null;

  const orgSnapshot = await db.collection(COLLECTIONS.organizations).doc(orgId).get();
  const organization = orgSnapshot.exists
    ? { ...(orgSnapshot.data() as Omit<Organization, 'id'>), id: orgSnapshot.id }
    : null;

  return { member, organization };
}

/** The user's active organisation membership, preferring the default org. */
async function resolveMembership(user: SessionUser): Promise<MembershipWithOrg | null> {
  const db = adminDb();

  if (user.defaultOrgId) {
    const preferred = await loadMembership(user.uid, user.defaultOrgId);
    if (preferred) return preferred;
  }

  const snapshot = await db
    .collection(COLLECTIONS.organizationMembers)
    .where('uid', '==', user.uid)
    .where('status', '==', 'active')
    .limit(5)
    .get();

  for (const doc of snapshot.docs) {
    const member = { ...(doc.data() as Omit<OrganizationMember, 'id'>), id: doc.id };
    const loaded = await loadMembership(user.uid, member.orgId);
    if (loaded) return loaded;
  }

  return null;
}

/**
 * Full authorisation context: the user plus their active organisation and role.
 * Returns null when the user has not completed onboarding.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const membership = await resolveMembership(user);
  if (!membership) return null;

  const organization = membership.organization;

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    orgId: membership.member.orgId,
    orgName: organization?.name ?? 'Your organisation',
    role: membership.member.role,
    roles: user.roles,
    currency: organization?.currency ?? serverConfig.defaults.currency,
    country: organization?.country ?? serverConfig.defaults.country,
    locale: organization?.locale ?? serverConfig.defaults.locale,
    onboardingCompleted: organization?.onboardingCompletedAt !== null && organization !== null,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuthContext();
  if (auth) return auth;

  // Distinguish "not signed in" from "signed in but no organisation", because the
  // second has a different remedy.
  const user = await getSessionUser();
  if (!user) throw unauthenticated();

  throw forbidden('Finish setting up your organisation before using this part of the product.');
}

export function requireRole(auth: AuthContext, roles: readonly OrgRole[]): void {
  if (!roles.includes(auth.role)) {
    throw forbidden(
      `This action needs one of the following roles: ${roles.join(', ')}. Your role is ${auth.role}.`,
    );
  }
}

/** Debug convenience: the emulator suite has no email verification step. */
export function isEmailVerificationRelaxed(): boolean {
  return isEmulatorMode || process.env.NODE_ENV !== 'production';
}

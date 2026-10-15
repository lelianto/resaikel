import type { IsoDateTime, Timestamped, Versioned } from '../common';

/**
 * Users and organisations are not org-scoped themselves - they are the tenancy
 * roots - so they carry only the shared id/timestamp/version fields rather than
 * the org-scoped `BaseDocument`.
 */
export interface RootDocument extends Timestamped, Versioned {
  readonly id: string;
}

export const ORG_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  member: 'Member',
  viewer: 'Viewer',
};

/** Roles a user can hold in the product. One account may hold several. */
export const USER_ROLES = ['material_owner', 'manufacturer', 'buyer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  material_owner: 'I have leftover materials',
  manufacturer: 'I make products',
  buyer: 'I want to buy reclaimed products',
};

export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  material_owner:
    'Upload leftover material, get it identified, and see what could be made from it.',
  manufacturer:
    'Register your workshop tools and capabilities, and evaluate what you can produce.',
  buyer: 'Describe what you need and find material and manufacturing to supply it.',
};

export interface UserProfile extends RootDocument {
  readonly uid: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly roles: readonly UserRole[];
  readonly defaultOrgId: string | null;
  readonly lastSignedInAt: IsoDateTime | null;
}

export interface Organization extends RootDocument {
  readonly name: string;
  readonly country: string;
  readonly city: string | null;
  readonly currency: string;
  readonly locale: string;
  readonly createdBy: string;
  readonly onboardingCompletedAt: IsoDateTime | null;
}

export interface OrganizationMember {
  readonly id: string;
  readonly orgId: string;
  readonly uid: string;
  readonly role: OrgRole;
  readonly status: 'active' | 'invited' | 'disabled';
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface AuthContext {
  readonly uid: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly displayName: string | null;
  readonly orgId: string;
  readonly orgName: string;
  readonly role: OrgRole;
  readonly roles: readonly UserRole[];
  readonly currency: string;
  readonly country: string;
  readonly locale: string;
  readonly onboardingCompleted: boolean;
}

export function canWrite(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

export function canAdminister(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin';
}

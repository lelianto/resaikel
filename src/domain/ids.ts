/**
 * Identifier helpers.
 *
 * `memberDocId` is load-bearing: the Firestore and Storage security rules look
 * up membership with a single `get()` on `organization_members/<orgId>_<uid>`.
 * The invariant that makes that unambiguous is that organisation ids are
 * Firebase auto-ids (alphanumeric, no underscore) and Firebase uids are
 * alphanumeric. `assertSafeIdSegment` enforces it at the boundary.
 */

export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function assertSafeIdSegment(value: string, label: string): string {
  if (!/^[A-Za-z0-9]+$/.test(value)) {
    throw new Error(`${label} must be alphanumeric so that membership ids stay unambiguous`);
  }
  return value;
}

export function memberDocId(orgId: string, uid: string): string {
  return `${assertSafeIdSegment(orgId, 'orgId')}_${assertSafeIdSegment(uid, 'uid')}`;
}

/** Storage object path for a private material photo. */
export function materialPhotoPath(
  orgId: string,
  materialId: string,
  fileName: string,
): string {
  return `materials/${orgId}/${materialId}/${fileName}`;
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * Firestore security-rules tests.
 *
 * These run against the REAL Firestore emulator (the in-memory fake used by the
 * service tests cannot evaluate `firestore.rules`). Start the emulator first:
 *
 *   npm run emulators        # terminal 1
 *   npm run test:rules       # terminal 2
 *
 * They verify the two guarantees the rules exist to provide:
 *   1. tenant isolation — a member of one org can never read another org's data;
 *   2. write lockout — every domain collection is server-written, so no client
 *      write is ever allowed (the user's own profile is the sole exception).
 */

const RULES_PATH = fileURLToPath(new URL('../../firestore.rules', import.meta.url));
const PROJECT_ID = 'resaikel-rules-test';
const HOST = '127.0.0.1';
const PORT = 8080;

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8'), host: HOST, port: PORT },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed membership and org-owned data with the rules bypassed, the way the
  // Admin SDK writes it in production.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'organization_members/org-a_user-a'), {
      orgId: 'org-a',
      uid: 'user-a',
      role: 'owner',
      status: 'active',
    });
    await setDoc(doc(db, 'organization_members/org-b_user-b'), {
      orgId: 'org-b',
      uid: 'user-b',
      role: 'owner',
      status: 'active',
    });
    await setDoc(doc(db, 'organization_members/org-a_user-c'), {
      orgId: 'org-a',
      uid: 'user-c',
      role: 'member',
      status: 'invited', // not active
    });

    for (const collection of [
      'materials',
      'product_opportunities',
      'production_outcomes',
      'cost_estimates',
      'feasibility_results',
      'buyer_requirements',
    ]) {
      await setDoc(doc(db, `${collection}/doc-a`), { orgId: 'org-a', value: 1 });
    }

    await setDoc(doc(db, 'product_templates/tpl-1'), { name: 'Shipping box' });
    await setDoc(doc(db, 'audit_events/evt-1'), { orgId: 'org-a' });
    await setDoc(doc(db, 'users/user-a'), { uid: 'user-a' });
  });
});

function asUser(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}

function asGuest() {
  return testEnv.unauthenticatedContext().firestore();
}

describe('tenant isolation', () => {
  it('lets an active member read their own org data', async () => {
    const db = asUser('user-a');
    await assertSucceeds(getDoc(doc(db, 'materials/doc-a')));
    await assertSucceeds(getDoc(doc(db, 'production_outcomes/doc-a')));
    await assertSucceeds(getDoc(doc(db, 'product_opportunities/doc-a')));
  });

  it('blocks a member of another org', async () => {
    const db = asUser('user-b');
    await assertFails(getDoc(doc(db, 'materials/doc-a')));
    await assertFails(getDoc(doc(db, 'production_outcomes/doc-a')));
    await assertFails(getDoc(doc(db, 'cost_estimates/doc-a')));
  });

  it('blocks an unauthenticated client', async () => {
    const db = asGuest();
    await assertFails(getDoc(doc(db, 'materials/doc-a')));
    await assertFails(getDoc(doc(db, 'production_outcomes/doc-a')));
  });

  it('treats an inactive membership as no membership', async () => {
    const db = asUser('user-c');
    await assertFails(getDoc(doc(db, 'materials/doc-a')));
  });
});

describe('write lockout', () => {
  it('forbids a member from writing org-owned documents', async () => {
    const db = asUser('user-a');
    await assertFails(setDoc(doc(db, 'materials/doc-a'), { orgId: 'org-a', value: 2 }));
    await assertFails(
      setDoc(doc(db, 'production_outcomes/new'), { orgId: 'org-a', value: 1 }),
    );
    await assertFails(setDoc(doc(db, 'product_opportunities/new'), { orgId: 'org-a' }));
  });
});

describe('user profiles and shared data', () => {
  it('lets a user read and create only their own profile', async () => {
    const db = asUser('user-a');
    await assertSucceeds(getDoc(doc(db, 'users/user-a')));
    await assertFails(getDoc(doc(db, 'users/user-b')));
    await assertSucceeds(setDoc(doc(db, 'users/user-a'), { uid: 'user-a', displayName: 'A' }));
    await assertFails(setDoc(doc(db, 'users/user-b'), { uid: 'user-b' }));
  });

  it('lets any signed-in user read shared reference data, but not guests', async () => {
    await assertSucceeds(getDoc(doc(asUser('user-b'), 'product_templates/tpl-1')));
    await assertFails(getDoc(doc(asGuest(), 'product_templates/tpl-1')));
  });

  it('never exposes server-internal collections', async () => {
    await assertFails(getDoc(doc(asUser('user-a'), 'audit_events/evt-1')));
  });
});

/**
 * Seed the emulator suite with a complete, explorable demo.
 *
 *   npm run emulators        # in one terminal
 *   npm run seed             # in another
 *
 * What it creates:
 *   - the curated market reference set
 *   - every validated product template from the catalogue
 *   - two registered buyer requirements (one consenting, one not)
 *   - a demo account you can sign in with: demo@resaikel.test / resaikel-demo
 *   - the three sample materials, with real photographs uploaded to the storage
 *     emulator, already confirmed
 *   - a full discovery run for each, so the opportunities screen is populated
 *
 * Everything it writes is flagged as sample data. Nothing here is real market
 * data, and no claim is made that any of it reflects a real workshop.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { evaluateMaterial } from '../src/server/services/discovery';
import { detectImageType } from '../src/server/firebase/storage';
import { adminAuth, adminBucket, adminDb, COLLECTIONS } from '../src/server/firebase/admin';
import { memberDocId, newRequestId } from '../src/domain/ids';
import { nowIso, SCHEMA_VERSION } from '../src/domain/common';
import { computeProductionOutcome } from '../src/domain/outcomes/engine';
import type {
  ProductionCostLines,
  ProductionOutcomeDocument,
} from '../src/domain/outcomes/types';
import type { OpportunityDocument } from '../src/domain/opportunity/types';
import { PRODUCT_TEMPLATES } from '../src/domain/catalog/templates';
import { SAMPLE_MARKET_EVIDENCE } from '../src/domain/demo/market-evidence';
import { sampleScenarios } from '../src/domain/demo/sample-scenarios';
import type { AuthContext } from '../src/domain/identity/types';
import type { Material, MaterialPhoto } from '../src/domain/materials/types';
import type { MaterialDocument, MaterialPhotoDocument } from '../src/server/repos/types';

const DEMO_USER = {
  uid: 'demoUser01',
  email: 'demo@resaikel.test',
  password: 'resaikel-demo',
  displayName: 'Demo Fabricator',
};

const DEMO_ORG_ID = 'demoOrg01';

const PHOTO_DIR = fileURLToPath(new URL('../tests/fixtures/photos/', import.meta.url));

/** Which fixture photograph belongs to which sample scenario. */
const SCENARIO_PHOTOS: Record<string, string> = {
  'plywood-offcuts': 'small-plywood-offcuts.jpg',
  'cardboard-waste': 'small-corrugated-cardboard.jpg',
  'undersized-cardboard': 'small-corrugated-cardboard.jpg',
};

function log(message: string): void {
  console.log(`  ${message}`);
}

async function ensureEmulatorReachable(): Promise<void> {
  try {
    await adminDb().collection('seed_probe').limit(1).get();
  } catch (error) {
    console.error(
      '\nCould not reach the Firestore emulator.\n' +
        'Start it first with `npm run emulators`, then run the seed again.\n',
    );
    throw error;
  }
}

async function seedReferenceData(): Promise<void> {
  const db = adminDb();

  const evidenceBatch = db.batch();
  for (const row of SAMPLE_MARKET_EVIDENCE) {
    evidenceBatch.set(db.collection(COLLECTIONS.marketEvidence).doc(row.id), row);
  }
  await evidenceBatch.commit();
  log(`market evidence: ${SAMPLE_MARKET_EVIDENCE.length} rows (all flagged as sample data)`);

  const templateBatch = db.batch();
  for (const template of PRODUCT_TEMPLATES) {
    templateBatch.set(db.collection(COLLECTIONS.productTemplates).doc(template.id), {
      ...template,
      schemaVersion: SCHEMA_VERSION,
      seededAt: nowIso(),
    });
  }
  await templateBatch.commit();
  log(`product templates: ${PRODUCT_TEMPLATES.length} validated specifications`);

  const componentCount = PRODUCT_TEMPLATES.reduce(
    (total, template) => total + template.parts.length,
    0,
  );
  log(`product components: ${componentCount} parts across those templates`);
}

async function seedDemoIdentity(): Promise<string> {
  const auth = adminAuth();

  let user;
  try {
    user = await auth.getUserByEmail(DEMO_USER.email);
  } catch {
    user = await auth.createUser({
      uid: DEMO_USER.uid,
      email: DEMO_USER.email,
      password: DEMO_USER.password,
      displayName: DEMO_USER.displayName,
      emailVerified: true,
    });
  }

  const db = adminDb();
  const timestamp = nowIso();

  await db.collection(COLLECTIONS.users).doc(user.uid).set(
    {
      uid: user.uid,
      displayName: DEMO_USER.displayName,
      email: DEMO_USER.email,
      emailVerified: true,
      roles: ['material_owner', 'manufacturer', 'buyer'],
      defaultOrgId: DEMO_ORG_ID,
      lastSignedInAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: SCHEMA_VERSION,
    },
    { merge: true },
  );

  await db.collection(COLLECTIONS.organizations).doc(DEMO_ORG_ID).set(
    {
      name: 'Demo Circular Workshop',
      country: 'ID',
      city: 'Jakarta',
      currency: 'IDR',
      locale: 'id-ID',
      createdBy: user.uid,
      onboardingCompletedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: SCHEMA_VERSION,
    },
    { merge: true },
  );

  await db
    .collection(COLLECTIONS.organizationMembers)
    .doc(memberDocId(DEMO_ORG_ID, user.uid))
    .set(
      {
        orgId: DEMO_ORG_ID,
        uid: user.uid,
        role: 'owner',
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      { merge: true },
    );

  const scenario = sampleScenarios()[0]!;
  const workshopRef = db.collection(COLLECTIONS.workshops).doc('demoWorkshop01');
  await workshopRef.set(
    {
      orgId: DEMO_ORG_ID,
      name: scenario.capability.name,
      city: 'Jakarta',
      country: 'ID',
      capacityNote: 'Sample profile: two people, hand tools and a circular saw.',
      createdBy: user.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: SCHEMA_VERSION,
    },
    { merge: true },
  );

  await db
    .collection(COLLECTIONS.workshopCapabilities)
    .doc('demoCapability01')
    .set(
      {
        orgId: DEMO_ORG_ID,
        workshopId: workshopRef.id,
        tools: [...scenario.capability.tools],
        processes: [...scenario.capability.processes],
        supportedFamilies: ['sheet_wood', 'solid_wood', 'cardboard', 'paper'],
        defaultLabourRatePerHourMinor: 30_000,
        notes: 'Sample capability profile used by the seed data.',
        createdAt: timestamp,
        updatedAt: timestamp,
        schemaVersion: SCHEMA_VERSION,
      },
      { merge: true },
    );

  log(`demo account: ${DEMO_USER.email} / ${DEMO_USER.password}`);
  log(`organisation: Demo Circular Workshop (${DEMO_ORG_ID}), currency IDR`);
  log(`workshop capability: ${scenario.capability.tools.length} tools, ${scenario.capability.processes.length} processes`);

  return user.uid;
}

async function seedBuyerRequirements(uid: string): Promise<void> {
  const db = adminDb();
  const timestamp = nowIso();

  const requirements = [
    {
      id: 'sampleRequirement1',
      buyerKind: 'b2b' as const,
      businessName: 'Sample Devices Refurb',
      industry: 'Refurbished electronics',
      location: 'Jakarta',
      country: 'ID',
      productCategories: ['packaging'],
      materialFamilies: ['cardboard'],
      minOrderQuantity: 5_000,
      budgetMinMinor: 3_000,
      budgetMaxMinor: 8_000,
      currency: 'IDR',
      capacityNote: 'Needs a steady monthly supply.',
      consentToMatch: true,
      verified: true,
    },
    {
      id: 'sampleRequirement2',
      buyerKind: 'b2b' as const,
      businessName: 'Sample Gift Studio',
      industry: 'Corporate gifting',
      location: 'Bandung',
      country: 'ID',
      productCategories: ['decor', 'desk_organisation'],
      materialFamilies: ['sheet_wood'],
      minOrderQuantity: 200,
      budgetMinMinor: 30_000,
      budgetMaxMinor: 90_000,
      currency: 'IDR',
      capacityNote: null,
      consentToMatch: true,
      verified: true,
    },
    {
      id: 'sampleRequirement3',
      buyerKind: 'b2c' as const,
      businessName: null,
      industry: null,
      location: 'Surabaya',
      country: 'ID',
      productCategories: ['storage'],
      materialFamilies: [],
      minOrderQuantity: 50,
      budgetMinMinor: null,
      budgetMaxMinor: 120_000,
      currency: 'IDR',
      capacityNote: 'Registered without consent to be shared.',
      // Deliberately not consented: it must never appear in a match result.
      consentToMatch: false,
      verified: false,
    },
  ];

  for (const requirement of requirements) {
    await db
      .collection(COLLECTIONS.buyerRequirements)
      .doc(requirement.id)
      .set({
        orgId: DEMO_ORG_ID,
        schemaVersion: SCHEMA_VERSION,
        ...requirement,
        createdBy: uid,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
  }

  const consented = requirements.filter((row) => row.consentToMatch).length;
  log(
    `buyer requirements: ${requirements.length} rows, ${consented} with consent ` +
      `(the third is deliberately unconsented and must never match)`,
  );
}

interface SeededPhoto {
  readonly path: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly mimeType: string;
  readonly sha256: string;
}

async function uploadPhoto(
  materialId: string,
  fileName: string,
  index: number,
): Promise<SeededPhoto | null> {
  const localPath = `${PHOTO_DIR}${fileName}`;
  if (!existsSync(localPath)) return null;

  const bytes = readFileSync(localPath);
  const detected = detectImageType(bytes);
  if (!detected) {
    console.warn(`  ! ${fileName} is not a recognised image; skipping it`);
    return null;
  }

  const storagePath = `materials/${DEMO_ORG_ID}/${materialId}/seed_${index + 1}.jpg`;
  await adminBucket().file(storagePath).save(bytes, { contentType: detected });

  return {
    path: storagePath,
    fileName,
    bytes: bytes.byteLength,
    mimeType: detected,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

async function seedMaterials(uid: string): Promise<void> {
  const db = adminDb();
  const scenarios = sampleScenarios();

  for (const scenario of scenarios) {
    const materialId = `sample_${scenario.id.replace(/-/g, '_')}`;
    const timestamp = nowIso();

    const uploaded = await uploadPhoto(
      materialId,
      SCENARIO_PHOTOS[scenario.id] ?? '',
      0,
    );

    const photoId = `${materialId}_photo1`;
    if (uploaded) {
      const photo: Omit<MaterialPhotoDocument, 'id'> = {
        orgId: DEMO_ORG_ID,
        materialId,
        storagePath: uploaded.path,
        fileName: uploaded.fileName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.bytes,
        sha256: uploaded.sha256,
        width: 900,
        height: 675,
        order: 0,
        createdAt: timestamp,
        schemaVersion: SCHEMA_VERSION,
      };
      await db.collection(COLLECTIONS.materialPhotos).doc(photoId).set(photo);
    }

    const provenance = {
      category: { source: 'user' as const, recordedAt: timestamp, note: 'Confirmed in the demo seed.' },
      lengthMm: { source: 'measured' as const, recordedAt: timestamp },
      widthMm: { source: 'measured' as const, recordedAt: timestamp },
      ...(scenario.material.thicknessMm !== null
        ? { thicknessMm: { source: 'measured' as const, recordedAt: timestamp } }
        : {}),
      quantity: { source: 'user' as const, recordedAt: timestamp },
      condition: { source: 'user' as const, recordedAt: timestamp },
    };

    const document: Omit<MaterialDocument, 'id'> = {
      orgId: DEMO_ORG_ID,
      schemaVersion: SCHEMA_VERSION,
      createdBy: uid,
      title: scenario.material.title,
      origin: 'Sample scenario seeded for the demo',
      notes: scenario.blurb,
      attributes: {
        category: scenario.material.category,
        subtype: null,
        color: null,
        texture: null,
        shape: 'Flat sheet',
        condition: scenario.material.condition,
        contamination: [...scenario.material.contamination],
        defects: [...scenario.material.defects],
      },
      quantity: { value: scenario.material.sheetCount, unit: 'sheet' },
      dimensions: {
        lengthMm: scenario.material.lengthMm,
        widthMm: scenario.material.widthMm,
        thicknessMm: scenario.material.thicknessMm,
      },
      provenance,
      availability: {
        availableQuantity: scenario.material.sheetCount,
        reservedQuantity: 0,
        usedQuantity: 0,
      },
      // Already confirmed, so discovery can run on it immediately.
      status: 'verified',
      photoCount: uploaded ? 1 : 0,
      primaryPhotoId: uploaded ? photoId : null,
      missingInformation: [],
      warnings: ['Sample data. Confirm the properties yourself before relying on any result.'],
      isSampleData: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      verifiedAt: timestamp,
    };

    await db.collection(COLLECTIONS.materials).doc(materialId).set(document);
    log(
      `material: ${scenario.material.title} — ${scenario.material.lengthMm} × ` +
        `${scenario.material.widthMm} mm, ${scenario.material.sheetCount} sheet(s)` +
        (uploaded ? `, photograph ${Math.round(uploaded.bytes / 1024)} KB` : ', no photograph'),
    );
  }
}

async function runDiscoveryForSeedMaterials(): Promise<void> {
  const db = adminDb();
  const scenarios = sampleScenarios();

  const auth: AuthContext = {
    uid: DEMO_USER.uid,
    email: DEMO_USER.email,
    emailVerified: true,
    displayName: DEMO_USER.displayName,
    orgId: DEMO_ORG_ID,
    orgName: 'Demo Circular Workshop',
    role: 'owner',
    roles: ['material_owner', 'manufacturer', 'buyer'],
    currency: 'IDR',
    country: 'ID',
    locale: 'id-ID',
    onboardingCompleted: true,
  };

  const capabilityRow = await db
    .collection(COLLECTIONS.workshopCapabilities)
    .doc('demoCapability01')
    .get();
  const capabilityData = capabilityRow.data();

  for (const scenario of scenarios) {
    const materialId = `sample_${scenario.id.replace(/-/g, '_')}`;
    const snapshot = await db.collection(COLLECTIONS.materials).doc(materialId).get();
    if (!snapshot.exists) continue;

    const stored = snapshot.data() as Omit<MaterialDocument, 'id'>;
    const photoRows = await db
      .collection(COLLECTIONS.materialPhotos)
      .where('materialId', '==', materialId)
      .get();

    const photos: MaterialPhoto[] = photoRows.docs
      .map((doc) => ({ ...(doc.data() as Omit<MaterialPhotoDocument, 'id'>), id: doc.id }))
      .map((photo) => ({
        id: photo.id,
        orgId: photo.orgId,
        materialId: photo.materialId,
        storagePath: photo.storagePath,
        fileName: photo.fileName,
        mimeType: photo.mimeType,
        sizeBytes: photo.sizeBytes,
        sha256: photo.sha256,
        width: photo.width,
        height: photo.height,
        order: photo.order,
        createdAt: photo.createdAt,
      }));

    const { photoCount: _count, primaryPhotoId: _primary, ...rest } = stored;
    const material: Material = { ...rest, id: materialId, photos };

    const result = await evaluateMaterial({
      auth,
      material,
      capability: capabilityData
        ? {
            name: String(capabilityData.name ?? 'Seeded workshop'),
            tools: capabilityData.tools ?? [],
            processes: capabilityData.processes ?? [],
            supportedFamilies: capabilityData.supportedFamilies ?? [],
          }
        : null,
      isSampleData: true,
    });

    for (const feasibility of result.feasibility) {
      const { id, ...payload } = feasibility;
      await db.collection(COLLECTIONS.feasibilityResults).doc(id).set(payload);
    }
    for (const cost of result.cost) {
      const { id, ...payload } = cost;
      await db.collection(COLLECTIONS.costEstimates).doc(id).set(payload);
    }
    for (const opportunity of result.opportunities) {
      const { id, ...payload } = opportunity;
      await db.collection(COLLECTIONS.productOpportunities).doc(id).set(payload);
    }

    const viable = result.opportunities.filter((row) => row.ranking?.gatesPassed === true).length;
    const rejected = result.opportunities.length - viable;
    log(
      `discovery: ${scenario.id} → ${result.opportunities.length} opportunities ` +
        `(${viable} viable, ${rejected} not viable)`,
    );
  }
}

/** A whole number of days before now, as an ISO timestamp. */
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Splits a batch cost across the five production cost lines so the parts sum
 * back to the exact total. Labour absorbs the rounding remainder, so no minor
 * unit is invented or lost — the same discipline the cost engine uses.
 */
function splitCost(totalMinor: number): ProductionCostLines {
  const additionalMaterialsMinor = Math.round(totalMinor * 0.1);
  const overheadMinor = Math.round(totalMinor * 0.2);
  const packagingMinor = Math.round(totalMinor * 0.1);
  const otherMinor = Math.round(totalMinor * 0.05);
  const labourMinor =
    totalMinor - additionalMaterialsMinor - overheadMinor - packagingMinor - otherMinor;
  return { additionalMaterialsMinor, labourMinor, overheadMinor, packagingMinor, otherMinor };
}

function unitRevenueMinor(summary: OpportunityDocument['summary']): number {
  return (
    summary.referencePriceMinor ??
    summary.minViablePriceMinor ??
    (summary.unitCostMinor !== null ? Math.round(summary.unitCostMinor * 1.8) : 60_000)
  );
}

interface OutcomeRunSpec {
  readonly daysAgo: number;
  readonly manufactured: number;
  readonly sold: number;
  readonly consumed: number;
  readonly waste: number;
}

/** One realised opportunity per scenario, each with a few completed runs. */
const OUTCOME_PLAN: Record<string, readonly OutcomeRunSpec[]> = {
  'plywood-offcuts': [
    { daysAgo: 48, manufactured: 6, sold: 4, consumed: 2, waste: 0.5 },
    { daysAgo: 15, manufactured: 8, sold: 8, consumed: 1.5, waste: 0.25 },
  ],
  'cardboard-waste': [{ daysAgo: 30, manufactured: 20, sold: 14, consumed: 4, waste: 1 }],
};

async function seedProductionOutcomes(uid: string): Promise<void> {
  const db = adminDb();
  const scenarios = sampleScenarios();
  let runs = 0;

  for (const scenario of scenarios) {
    const plan = OUTCOME_PLAN[scenario.id];
    if (!plan) continue;

    const materialId = `sample_${scenario.id.replace(/-/g, '_')}`;
    const materialSnapshot = await db.collection(COLLECTIONS.materials).doc(materialId).get();
    const materialUnit =
      (materialSnapshot.data()?.quantity?.unit as string | undefined) ?? 'sheet';

    const oppSnapshot = await db
      .collection(COLLECTIONS.productOpportunities)
      .where('orgId', '==', DEMO_ORG_ID)
      .where('materialId', '==', materialId)
      .get();

    const viable = oppSnapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<OpportunityDocument, 'id'>) }))
      .filter((opp) => opp.ranking?.gatesPassed === true)
      .sort((a, b) => (b.ranking?.score ?? 0) - (a.ranking?.score ?? 0));

    const opportunity = viable[0];
    if (!opportunity) {
      log(`outcomes: ${scenario.id} has no viable opportunity yet; skipped`);
      continue;
    }

    // Mark the realised opportunity as saved so it anchors the outcome history.
    await db
      .collection(COLLECTIONS.productOpportunities)
      .doc(opportunity.id)
      .set({ saved: true, savedAt: nowIso(), updatedAt: nowIso() }, { merge: true });

    const unitRevenue = unitRevenueMinor(opportunity.summary);
    const unitCost =
      opportunity.summary.unitCostMinor ?? Math.max(1, Math.round(unitRevenue / 1.8));

    for (const spec of plan) {
      const occurredAt = isoDaysAgo(spec.daysAgo);
      const actualRevenueMinor = unitRevenue * spec.sold;
      const costLines = splitCost(unitCost * spec.manufactured);

      const input = {
        quantityManufactured: spec.manufactured,
        quantitySold: spec.sold,
        materialConsumedQuantity: spec.consumed,
        remainingMaterialQuantity: Math.max(
          0,
          scenario.material.sheetCount - spec.consumed - spec.waste,
        ),
        unusedWasteQuantity: spec.waste,
        actualRevenueMinor,
        costLines,
      };
      const metrics = computeProductionOutcome(input);

      const document: Omit<ProductionOutcomeDocument, 'id'> & { isSampleData: boolean } = {
        orgId: DEMO_ORG_ID,
        schemaVersion: SCHEMA_VERSION,
        opportunityId: opportunity.id,
        materialId,
        productName: opportunity.productName,
        currency: opportunity.summary.currency,
        materialQuantityUnit: materialUnit,
        estimatedMaxUnits: opportunity.summary.maxUnits,
        estimatedUnitCostMinor: opportunity.summary.unitCostMinor,
        ...input,
        ...metrics,
        notes: 'Sample completed production recorded by the seed.',
        occurredAt,
        createdBy: uid,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        isSampleData: true,
      };

      await db.collection(COLLECTIONS.productionOutcomes).doc(newRequestId()).set(document);
      runs += 1;
    }

    log(
      `outcomes: ${scenario.id} → "${opportunity.productName}" marked saved, ` +
        `${plan.length} completed run(s)`,
    );
  }

  log(`production outcomes: ${runs} record(s) so the impact report shows real figures`);
}

async function main(): Promise<void> {
  console.log('\nresaikel — seeding the emulator suite\n');

  await ensureEmulatorReachable();

  console.log('Reference data');
  await seedReferenceData();

  console.log('\nDemo identity');
  const uid = await seedDemoIdentity();

  console.log('\nDemand');
  await seedBuyerRequirements(uid);

  console.log('\nMaterials with real photographs');
  await seedMaterials(uid);

  console.log('\nDiscovery');
  await runDiscoveryForSeedMaterials();

  console.log('\nCompleted production');
  await seedProductionOutcomes(uid);

  console.log(
    '\nDone. Sign in with demo@resaikel.test / resaikel-demo\n' +
      'Every record written above is flagged as sample data.\n',
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('\nSeeding failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });

import { z } from 'zod';

import { PRODUCT_CATEGORIES } from '@/domain/catalog/types';
import { ORG_ROLES, USER_ROLES } from '@/domain/identity/types';
import {
  CONDITION_GRADES,
  MATERIAL_CATEGORIES,
  MATERIAL_FAMILIES,
  QUANTITY_UNITS,
} from '@/domain/materials/types';

/**
 * Request body contracts.
 *
 * These are the only schemas applied to untrusted input. Anything a client sends
 * is reduced to exactly what the named schema allows before it reaches domain
 * logic, so a crafted body cannot smuggle extra fields into a Firestore write.
 */

const millimetres = z.number().int().min(1).max(30_000);
const moneyMinor = z.number().int().min(0).max(1_000_000_000);

export const sessionCreateSchema = z.object({
  idToken: z.string().min(20).max(4096),
});

export const onboardingSchema = z.object({
  displayName: z.string().trim().max(80).nullable().optional(),
  roles: z.array(z.enum(USER_ROLES)).min(1).max(3),
  orgName: z.string().trim().min(2).max(120),
  country: z.string().trim().length(2).default('ID'),
  city: z.string().trim().max(80).nullable().optional(),
  currency: z.string().trim().length(3).default('IDR'),
  locale: z.string().trim().max(10).default('id-ID'),
});

export const materialCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  origin: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  category: z.enum(MATERIAL_CATEGORIES).default('unknown'),
  condition: z.enum(CONDITION_GRADES).default('unknown'),
  contamination: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  defects: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  quantityValue: z.number().positive().max(1_000_000),
  quantityUnit: z.enum(QUANTITY_UNITS),
  lengthMm: millimetres.nullable().optional(),
  widthMm: millimetres.nullable().optional(),
  thicknessMm: millimetres.nullable().optional(),
  isSampleData: z.boolean().default(false),
});

export const materialPatchSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    origin: z.string().trim().max(200).nullable(),
    notes: z.string().trim().max(2000).nullable(),
    category: z.enum(MATERIAL_CATEGORIES),
    subtype: z.string().trim().max(80).nullable(),
    color: z.string().trim().max(60).nullable(),
    texture: z.string().trim().max(60).nullable(),
    shape: z.string().trim().max(60).nullable(),
    condition: z.enum(CONDITION_GRADES),
    contamination: z.array(z.string().trim().min(1).max(80)).max(20),
    defects: z.array(z.string().trim().min(1).max(80)).max(20),
    lengthMm: millimetres,
    widthMm: millimetres,
    thicknessMm: millimetres,
    quantityValue: z.number().positive().max(1_000_000),
    quantityUnit: z.enum(QUANTITY_UNITS),
    reservedQuantity: z.number().min(0).max(1_000_000),
    /** How the user knows a dimension: measured with a tool, or estimated. */
    dimensionSource: z.enum(['measured', 'user']).default('measured'),
  })
  .partial();

export const materialConfirmSchema = z.object({
  patch: materialPatchSchema.optional(),
});

/**
 * Metadata fields that accompany a photo's bytes in a multipart upload.
 *
 * Form values arrive as strings, so numeric fields are coerced. The storage path
 * is deliberately absent: the server derives it from the authenticated tenant and
 * material, never from a client claim.
 */
export const photoUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(120),
  width: z.coerce.number().int().positive().max(20_000).nullable().optional(),
  height: z.coerce.number().int().positive().max(20_000).nullable().optional(),
  order: z.coerce.number().int().min(0).max(20).default(0),
});

export const assumptionsSchema = z.record(z.string().max(60), z.number().finite());

export const discoverSchema = z.object({
  overrides: assumptionsSchema.optional(),
  targetMarket: z.string().trim().max(80).nullable().optional(),
  /** Clears previous opportunities for this material before re-running. */
  replace: z.boolean().default(true),
});

export const costEstimateSchema = z.object({
  overrides: assumptionsSchema.default({}),
  priceBands: z
    .object({
      lowMinor: moneyMinor,
      referenceMinor: moneyMinor,
      highMinor: moneyMinor,
      sampleSize: z.number().int().min(0).max(1000),
    })
    .nullable()
    .optional(),
});

export const opportunitySaveSchema = z.object({
  saved: z.boolean(),
});

const outcomeCostLinesSchema = z.object({
  additionalMaterialsMinor: moneyMinor,
  labourMinor: moneyMinor,
  overheadMinor: moneyMinor,
  packagingMinor: moneyMinor,
  otherMinor: moneyMinor,
});

export const productionOutcomeSchema = z
  .object({
    quantityManufactured: z.number().int().min(0).max(1_000_000),
    quantitySold: z.number().int().min(0).max(1_000_000),
    materialConsumedQuantity: z.number().min(0).max(1_000_000),
    remainingMaterialQuantity: z.number().min(0).max(1_000_000),
    unusedWasteQuantity: z.number().min(0).max(1_000_000),
    actualRevenueMinor: moneyMinor,
    costLines: outcomeCostLinesSchema,
    occurredAt: z.string().datetime(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => value.quantitySold <= value.quantityManufactured, {
    message: 'Quantity sold cannot exceed quantity manufactured.',
    path: ['quantitySold'],
  });

export const workshopSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().length(2).default('ID'),
  capacityNote: z.string().trim().max(300).nullable().optional(),
  tools: z.array(z.string().trim().max(40)).max(40).default([]),
  processes: z.array(z.string().trim().max(40)).max(40).default([]),
  supportedFamilies: z.array(z.enum(MATERIAL_FAMILIES)).max(10).default([]),
  labourRatePerHourMinor: moneyMinor.nullable().optional(),
});

export const buyerRequirementSchema = z
  .object({
    buyerKind: z.enum(['b2c', 'b2b']),
    businessName: z.string().trim().max(120).nullable().optional(),
    industry: z.string().trim().max(120).nullable().optional(),
    location: z.string().trim().max(80).nullable().optional(),
    country: z.string().trim().length(2).nullable().optional(),
    productCategories: z.array(z.enum(PRODUCT_CATEGORIES)).min(1).max(8),
    materialFamilies: z.array(z.enum(MATERIAL_FAMILIES)).max(8).default([]),
    minOrderQuantity: z.number().int().positive().max(1_000_000).nullable().optional(),
    budgetMinMinor: moneyMinor.nullable().optional(),
    budgetMaxMinor: moneyMinor.nullable().optional(),
    currency: z.string().trim().length(3).default('IDR'),
    capacityNote: z.string().trim().max(300).nullable().optional(),
    /** Without explicit consent the record is never used for matching. */
    consentToMatch: z.boolean(),
  })
  .refine(
    (value) =>
      value.budgetMinMinor === null ||
      value.budgetMaxMinor === null ||
      value.budgetMinMinor === undefined ||
      value.budgetMaxMinor === undefined ||
      value.budgetMinMinor <= value.budgetMaxMinor,
    { message: 'The minimum budget must not exceed the maximum budget.', path: ['budgetMinMinor'] },
  );

export const orgSettingsSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    country: z.string().trim().length(2),
    city: z.string().trim().max(80).nullable(),
    currency: z.string().trim().length(3),
    locale: z.string().trim().max(10),
  })
  .partial();

export const roleSchema = z.enum(ORG_ROLES);

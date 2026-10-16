import { nowIso, SCHEMA_VERSION } from '@/domain/common';
import type { AuthContext } from '@/domain/identity/types';
import { newRequestId } from '@/domain/ids';
import { computeProductionOutcome } from '@/domain/outcomes/engine';
import type { ProductionOutcomeDocument, ProductionOutcomeInput } from '@/domain/outcomes/types';

import { HttpError } from '../http/errors';
import { getMaterialDocument } from '../repos/materials';
import { getOpportunityDocument } from '../repos/opportunities';
import { createProductionOutcome } from '../repos/outcomes';

export interface RecordProductionOutcomeInput extends ProductionOutcomeInput {
  readonly auth: AuthContext;
  readonly opportunityId: string;
  readonly occurredAt: string;
  readonly notes: string | null;
}

export async function recordProductionOutcome(
  input: RecordProductionOutcomeInput,
): Promise<ProductionOutcomeDocument> {
  const opportunity = await getOpportunityDocument(input.auth.orgId, input.opportunityId);
  if (!opportunity) {
    throw new HttpError('OPPORTUNITY_NOT_FOUND', 'That opportunity does not exist.');
  }
  if (!opportunity.saved) {
    throw new HttpError(
      'CONFLICT',
      'Save this opportunity before recording an actual production outcome.',
    );
  }

  const material = await getMaterialDocument(input.auth.orgId, opportunity.materialId);
  if (!material) {
    throw new HttpError('MATERIAL_NOT_FOUND', 'The source material no longer exists.');
  }

  const timestamp = nowIso();
  const metrics = computeProductionOutcome(input);
  const document: ProductionOutcomeDocument = {
    id: newRequestId(),
    orgId: input.auth.orgId,
    schemaVersion: SCHEMA_VERSION,
    opportunityId: opportunity.id,
    materialId: opportunity.materialId,
    productName: opportunity.productName,
    currency: opportunity.summary.currency,
    materialQuantityUnit: material.quantity.unit,
    estimatedMaxUnits: opportunity.summary.maxUnits,
    estimatedUnitCostMinor: opportunity.summary.unitCostMinor,
    quantityManufactured: input.quantityManufactured,
    quantitySold: input.quantitySold,
    materialConsumedQuantity: input.materialConsumedQuantity,
    remainingMaterialQuantity: input.remainingMaterialQuantity,
    unusedWasteQuantity: input.unusedWasteQuantity,
    actualRevenueMinor: input.actualRevenueMinor,
    costLines: input.costLines,
    ...metrics,
    notes: input.notes,
    occurredAt: input.occurredAt,
    createdBy: input.auth.uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await createProductionOutcome(document);
  return document;
}

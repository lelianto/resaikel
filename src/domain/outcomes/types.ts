import type { IsoDateTime } from '@/domain/common';

export interface ProductionCostLines {
  readonly additionalMaterialsMinor: number;
  readonly labourMinor: number;
  readonly overheadMinor: number;
  readonly packagingMinor: number;
  readonly otherMinor: number;
}

export interface ProductionOutcomeInput {
  readonly quantityManufactured: number;
  readonly quantitySold: number;
  readonly materialConsumedQuantity: number;
  readonly remainingMaterialQuantity: number;
  readonly unusedWasteQuantity: number;
  readonly actualRevenueMinor: number;
  readonly costLines: ProductionCostLines;
}

export interface ProductionOutcomeMetrics {
  readonly totalActualCostMinor: number;
  readonly actualGrossProfitMinor: number;
  readonly actualGrossMarginBps: number | null;
  readonly averageRevenuePerSoldUnitMinor: number | null;
  readonly averageCostPerManufacturedUnitMinor: number | null;
  readonly sellThroughBps: number | null;
}

export interface ProductionOutcomeDocument
  extends ProductionOutcomeInput,
    ProductionOutcomeMetrics {
  readonly id: string;
  readonly orgId: string;
  readonly schemaVersion: number;
  readonly opportunityId: string;
  readonly materialId: string;
  readonly productName: string;
  readonly currency: string;
  readonly materialQuantityUnit: string;
  readonly estimatedMaxUnits: number;
  readonly estimatedUnitCostMinor: number | null;
  readonly notes: string | null;
  readonly occurredAt: IsoDateTime;
  readonly createdBy: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

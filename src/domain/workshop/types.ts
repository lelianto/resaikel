import type { ProcessId, ToolId } from '../catalog/types';
import type { BaseDocument, IsoDateTime } from '../common';
import type { MaterialFamily } from '../materials/types';

/**
 * Workshop profile.
 *
 * Only the minimum needed for the feasibility engine's tool and process gates
 * exists in this pass: a name, the tools, the processes and the material families
 * the workshop claims to support. A full manufacturer marketplace is deferred.
 */

export interface Workshop extends BaseDocument {
  readonly name: string;
  readonly city: string | null;
  readonly country: string;
  readonly capacityNote: string | null;
  readonly createdBy: string;
}

export interface WorkshopCapability {
  readonly id: string;
  readonly orgId: string;
  readonly workshopId: string;
  readonly schemaVersion: number;
  readonly tools: readonly ToolId[];
  readonly processes: readonly ProcessId[];
  readonly supportedFamilies: readonly MaterialFamily[];
  readonly defaultLabourRatePerHourMinor: number | null;
  readonly notes: string | null;
  readonly updatedAt: IsoDateTime;
  readonly createdAt: IsoDateTime;
}

export const EMPTY_CAPABILITY: Omit<WorkshopCapability, 'id' | 'orgId' | 'workshopId' | 'createdAt' | 'updatedAt' | 'schemaVersion'> = {
  tools: [],
  processes: [],
  supportedFamilies: [],
  defaultLabourRatePerHourMinor: null,
  notes: null,
};

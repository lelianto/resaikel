import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { MaterialStatus } from '@/domain/materials/types';
import { MATERIAL_STATUS_LABELS } from '@/domain/materials/types';
import type { FeasibilityStatus } from '@/domain/feasibility/types';
import { FEASIBILITY_LABELS, FEASIBILITY_TONE } from '@/domain/feasibility/types';
import type { EvidenceQuality } from '@/domain/market/types';
import { EVIDENCE_QUALITY_LABELS, EVIDENCE_QUALITY_TONE } from '@/domain/market/types';

const MATERIAL_TONE: Record<MaterialStatus, BadgeTone> = {
  draft: 'neutral',
  analyzing: 'info',
  needs_confirmation: 'warning',
  verified: 'success',
  archived: 'neutral',
};

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  return <Badge tone={MATERIAL_TONE[status]}>{MATERIAL_STATUS_LABELS[status]}</Badge>;
}

export function FeasibilityBadge({ status }: { status: FeasibilityStatus }) {
  return <Badge tone={FEASIBILITY_TONE[status]}>{FEASIBILITY_LABELS[status]}</Badge>;
}

export function EvidenceQualityBadge({ quality }: { quality: EvidenceQuality }) {
  return (
    <Badge tone={EVIDENCE_QUALITY_TONE[quality]}>{EVIDENCE_QUALITY_LABELS[quality]}</Badge>
  );
}

export function SampleDataBadge() {
  return (
    <Badge tone="accent" technical>
      Sample data
    </Badge>
  );
}

export function ConceptOnlyBadge() {
  return (
    <Badge tone="warning" title="No validated manufacturing specification exists for this idea.">
      Concept only — validation required
    </Badge>
  );
}

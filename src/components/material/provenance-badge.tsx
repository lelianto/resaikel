import { Bot, Ruler, UserCheck, HelpCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { FieldProvenance, ProvenanceSource } from '@/domain/materials/types';
import { PROVENANCE_LABELS } from '@/domain/materials/types';

/**
 * Provenance badge.
 *
 * Every material attribute is labelled with where its value came from. This is the
 * UI half of the rule that a single global confidence score must never stand in
 * for physical safety: a measured dimension and a model's guess are visibly
 * different things.
 */

const CONFIG: Record<
  ProvenanceSource,
  { tone: 'success' | 'accent' | 'warning' | 'neutral'; icon: typeof Bot }
> = {
  measured: { tone: 'success', icon: Ruler },
  user: { tone: 'success', icon: UserCheck },
  ai: { tone: 'accent', icon: Bot },
  unknown: { tone: 'neutral', icon: HelpCircle },
};

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: FieldProvenance | undefined;
  className?: string;
}) {
  const source: ProvenanceSource = provenance?.source ?? 'unknown';
  const config = CONFIG[source];
  const Icon = config.icon;

  const confidence =
    source === 'ai' && provenance?.confidence !== undefined
      ? ` ${Math.round(provenance.confidence * 100)}%`
      : '';

  return (
    <Badge
      tone={config.tone}
      technical
      icon={<Icon className="size-3" aria-hidden />}
      className={className}
      title={provenance?.note ?? PROVENANCE_LABELS[source]}
    >
      {PROVENANCE_LABELS[source]}
      {confidence}
    </Badge>
  );
}

/**
 * A small inline note explaining why a value cannot be trusted yet. Used next to
 * fields that are still AI-inferred.
 */
export function ProvenanceHint({ provenance }: { provenance: FieldProvenance | undefined }) {
  if (!provenance || provenance.source !== 'ai') return null;
  return (
    <span className="text-xs text-ink-muted">
      Inferred from the photograph. Confirm it before relying on it.
    </span>
  );
}

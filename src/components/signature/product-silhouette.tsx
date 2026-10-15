import { Archive, Frame, Package, PencilRuler, Store, Utensils } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ProductCategory } from '@/domain/catalog/types';
import { cn } from '@/lib/cn';
import { GridBackdrop } from './annotations';

const CATEGORY_ICONS: Record<ProductCategory, ReactNode> = {
  packaging: <Package className="size-8" strokeWidth={1.25} aria-hidden />,
  desk_organisation: <PencilRuler className="size-8" strokeWidth={1.25} aria-hidden />,
  display: <Store className="size-8" strokeWidth={1.25} aria-hidden />,
  kitchenware: <Utensils className="size-8" strokeWidth={1.25} aria-hidden />,
  decor: <Frame className="size-8" strokeWidth={1.25} aria-hidden />,
  storage: <Archive className="size-8" strokeWidth={1.25} aria-hidden />,
};

/**
 * Product preview frame.
 *
 * resaikel does not generate product imagery. Rather than showing a stock photo
 * or a fabricated render, each product is represented by a measured frame with
 * its category glyph and the part count - honest about being a specification,
 * not a photograph.
 */
export function ProductSilhouette({
  category,
  partCount,
  className,
  compact = false,
}: {
  category: ProductCategory;
  partCount?: number;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative isolate flex items-center justify-center overflow-hidden bg-surface-sunken',
        compact ? 'h-24' : 'aspect-[4/3]',
        className,
      )}
      role="img"
      aria-label={`Schematic preview for a ${category.replace(/_/g, ' ')} product`}
    >
      <GridBackdrop />
      <div className="relative flex flex-col items-center gap-2 text-ink-faint">
        {CATEGORY_ICONS[category]}
        {partCount !== undefined && !compact ? (
          <span className="micro-label">{partCount} parts / unit</span>
        ) : null}
      </div>
      {/* Corner ticks reinforce the technical framing without adding noise. */}
      <span aria-hidden className="absolute left-2 top-2 size-2 border-l border-t border-line-strong" />
      <span aria-hidden className="absolute right-2 top-2 size-2 border-r border-t border-line-strong" />
      <span
        aria-hidden
        className="absolute bottom-2 left-2 size-2 border-b border-l border-line-strong"
      />
      <span
        aria-hidden
        className="absolute bottom-2 right-2 size-2 border-b border-r border-line-strong"
      />
    </div>
  );
}

/** Square material chip with a paper texture overlay and an optional colour. */
export function MaterialChip({
  color,
  label,
  className,
}: {
  color?: string | null;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'material-texture inline-block size-8 shrink-0 rounded-sm border border-line-strong',
        !color && 'bg-surface-subtle',
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

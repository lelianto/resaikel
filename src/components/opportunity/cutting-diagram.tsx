import { DimensionLine } from '@/components/signature/annotations';
import type { StockUsage } from '@/domain/feasibility/packing';
import { formatMm } from '@/domain/units';

/**
 * Cutting layout diagram.
 *
 * Renders the *actual* packer output for one finished unit — the same placements
 * the feasibility engine used — so the diagram cannot drift from the numbers.
 * Kerf is drawn as the gap between parts rather than being hidden.
 */

/**
 * Explicit colours rather than utility classes, because the same value is needed
 * for an SVG `fill` and for the legend swatch's CSS background.
 */
const PART_FILLS = [
  'rgb(35 78 59 / 0.82)',
  'rgb(35 78 59 / 0.55)',
  'rgb(180 138 87 / 0.70)',
  'rgb(35 78 59 / 0.34)',
  'rgb(180 138 87 / 0.45)',
  'rgb(104 113 106 / 0.42)',
] as const;

export function CuttingDiagram({
  sheet,
  kerfMm,
  className,
}: {
  sheet: StockUsage | null;
  kerfMm: number;
  className?: string;
}) {
  if (!sheet) {
    return (
      <p className="text-sm text-ink-muted">
        No cutting layout is available. A layout is only produced once the material dimensions are
        confirmed.
      </p>
    );
  }

  const padding = 28;
  const width = sheet.lengthMm;
  const height = sheet.widthMm;
  const viewBox = `${-padding} ${-padding} ${width + padding * 2} ${height + padding * 2}`;

  // Parts are coloured by part id so a repeated part reads as one thing.
  const partIds = [...new Set(sheet.placements.map((placement) => placement.partId))];
  const colourFor = (partId: string): string =>
    PART_FILLS[partIds.indexOf(partId) % PART_FILLS.length] ?? PART_FILLS[0];

  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-lg border border-line bg-surface p-4">
        <svg
          viewBox={viewBox}
          role="img"
          aria-label={`Cutting layout on a ${sheet.lengthMm} by ${sheet.widthMm} millimetre sheet, ${sheet.placements.length} parts`}
          className="h-auto w-full"
        >
          {/* Stock */}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="rgb(241 240 235)"
            stroke="rgb(195 200 188)"
            strokeWidth={Math.max(1, width * 0.002)}
            rx={width * 0.004}
          />

          {/* Parts */}
          {sheet.placements.map((placement, index) => (
            <g key={`${placement.partId}-${index}`}>
              <rect
                x={placement.xMm}
                y={placement.yMm}
                width={placement.lengthMm}
                height={placement.widthMm}
                fill={colourFor(placement.partId)}
                rx={width * 0.003}
              />
              <text
                x={placement.xMm + placement.lengthMm / 2}
                y={placement.yMm + placement.widthMm / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgb(251 251 248)"
                style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                fontSize={Math.max(8, width * 0.022)}
              >
                {placement.rotated
                  ? `${placement.widthMm}×${placement.lengthMm}`
                  : `${placement.lengthMm}×${placement.widthMm}`}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <figcaption className="mt-3 space-y-2">
        <DimensionLine label={`Sheet length ${formatMm(sheet.lengthMm)}`} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="micro-label">
            Sheet {sheet.stockInstance} · {sheet.partCount} part(s) ·{' '}
            {Math.round((sheet.usedAreaMm2 / sheet.stockAreaMm2) * 100)}% of this sheet is product
          </p>
          <p className="micro-label">Kerf {formatMm(kerfMm)}</p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {partIds.map((partId) => {
            const placement = sheet.placements.find((entry) => entry.partId === partId);
            const count = sheet.placements.filter((entry) => entry.partId === partId).length;
            return (
              <li key={partId} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-3 rounded-xs"
                  style={{ backgroundColor: colourFor(partId) }}
                />
                <span className="micro-label">
                  {placement?.partName ?? partId} × {count}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs leading-relaxed text-ink-faint">
          This is a guillotine approximation of a hand-cut layout, not a machine nesting file. Kerf is
          deducted on every cut, and the corner areas a guillotine split cannot recover are counted as
          waste.
        </p>
      </figcaption>
    </figure>
  );
}

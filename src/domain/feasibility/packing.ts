/**
 * Deterministic 2D cutting and packing for rectangular stock.
 *
 * This is intentionally *not* a CAD/CAM nesting engine. It answers one question
 * conservatively and reproducibly: how many of these rectangles can be cut from
 * that offcut stock, accounting for blade kerf, an optional rotation allowance
 * and excluded defect zones?
 *
 * Algorithm
 * ---------
 * Guillotine-style free-rectangle packing with a best-short-side-fit rule:
 *
 *  1. Stock pieces are expanded into individual sheet instances. Each instance's
 *     free space starts as one rectangle, then every defect zone is subtracted
 *     using a four-way disjoint decomposition so free rectangles never overlap.
 *  2. Parts are expanded to individual instances and sorted by descending area,
 *     with id as the tie-break so the result is bit-for-bit reproducible.
 *  3. Each part is placed into the open sheet that gives the smallest leftover
 *     short side. A new sheet is only opened when the part fits nowhere already
 *     open, which minimises sheet count.
 *  4. Placing a part splits its free rectangle with a guillotine cut, preserving
 *     the larger remainder. Kerf is deducted from both the cut and the
 *     perpendicular edge, so waste is *over*-estimated rather than under.
 *
 * The corner areas lost to guillotine splitting are counted as waste. That is a
 * deliberate conservatism: a hand-cut offcut will not achieve perfect nesting.
 */

export interface DefectZone {
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface StockPiece {
  readonly id: string;
  readonly label: string;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly quantity: number;
  readonly defectZones?: readonly DefectZone[];
}

export interface PartToPack {
  readonly id: string;
  readonly name: string;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly quantity: number;
  readonly rotatable: boolean;
}

export interface Placement {
  readonly partId: string;
  readonly partName: string;
  readonly stockId: string;
  readonly stockInstance: number;
  readonly xMm: number;
  readonly yMm: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly rotated: boolean;
}

export interface StockUsage {
  readonly stockId: string;
  readonly stockInstance: number;
  readonly label: string;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly stockAreaMm2: number;
  readonly usedAreaMm2: number;
  readonly partCount: number;
  readonly placements: readonly Placement[];
}

export interface UnplacedPart {
  readonly partId: string;
  readonly partName: string;
  readonly quantity: number;
  readonly reason: string;
}

export interface PackingResult {
  readonly placements: readonly Placement[];
  readonly unplaced: readonly UnplacedPart[];
  readonly stockUsage: readonly StockUsage[];
  readonly stockConsumed: number;
  readonly stockAvailable: number;
  readonly totalStockAreaMm2: number;
  readonly usedAreaMm2: number;
  /** Waste as a percentage of the area of the sheets actually consumed. */
  readonly wastePercent: number;
  readonly kerfMm: number;
  /** True when the input exceeded the configured complexity guard. */
  readonly limitReached: boolean;
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface OpenSheet {
  stockId: string;
  stockInstance: number;
  label: string;
  lengthMm: number;
  widthMm: number;
  free: FreeRect[];
  placements: Placement[];
  usedAreaMm2: number;
}

export interface PackOptions {
  readonly stock: readonly StockPiece[];
  readonly parts: readonly PartToPack[];
  readonly kerfMm: number;
  /** Guard against pathological inputs; 400 part instances is already a lot. */
  readonly maxParts?: number;
  readonly maxStockInstances?: number;
}

const DEFAULT_MAX_PARTS = 400;
const DEFAULT_MAX_STOCK_INSTANCES = 200;

function rectsIntersect(a: FreeRect, b: DefectZone): boolean {
  return (
    b.xMm < a.x + a.w &&
    b.xMm + b.widthMm > a.x &&
    b.yMm < a.y + a.h &&
    b.yMm + b.heightMm > a.y
  );
}

/**
 * Subtracts a defect zone from a free rectangle, producing up to four mutually
 * disjoint rectangles. Disjointness is what keeps two placements from ever
 * overlapping.
 */
function subtractDefect(rect: FreeRect, defect: DefectZone): FreeRect[] {
  const result: FreeRect[] = [];
  const defectRight = defect.xMm + defect.widthMm;
  const defectBottom = defect.yMm + defect.heightMm;
  const rectRight = rect.x + rect.w;
  const rectBottom = rect.y + rect.h;

  // Left band, full height.
  if (defect.xMm > rect.x) {
    result.push({ x: rect.x, y: rect.y, w: defect.xMm - rect.x, h: rect.h });
  }
  // Right band, full height.
  if (defectRight < rectRight) {
    result.push({ x: defectRight, y: rect.y, w: rectRight - defectRight, h: rect.h });
  }
  // Middle band, above the defect.
  const middleX = Math.max(rect.x, defect.xMm);
  const middleW = Math.min(rectRight, defectRight) - middleX;
  if (middleW > 0) {
    if (defect.yMm > rect.y) {
      result.push({ x: middleX, y: rect.y, w: middleW, h: defect.yMm - rect.y });
    }
    if (defectBottom < rectBottom) {
      result.push({ x: middleX, y: defectBottom, w: middleW, h: rectBottom - defectBottom });
    }
  }

  return result;
}

function applyDefects(rect: FreeRect, defects: readonly DefectZone[]): FreeRect[] {
  let current: FreeRect[] = [rect];
  for (const defect of defects) {
    const next: FreeRect[] = [];
    for (const candidate of current) {
      if (rectsIntersect(candidate, defect)) next.push(...subtractDefect(candidate, defect));
      else next.push(candidate);
    }
    current = next;
  }
  return current.filter((r) => r.w > 0 && r.h > 0);
}

function rectArea(rect: FreeRect): number {
  return rect.w * rect.h;
}

interface Candidate {
  sheet: number;
  rect: number;
  rotated: boolean;
  partW: number;
  partH: number;
  shortSideLeftover: number;
  longSideLeftover: number;
  rectAreaMm2: number;
}

/**
 * Best-short-side-fit. Ties are broken by sheet then rectangle index so the
 * outcome never depends on iteration order of a hash map.
 */
function findBestCandidate(
  sheets: readonly OpenSheet[],
  partLength: number,
  partWidth: number,
  rotatable: boolean,
): Candidate | null {
  let best: Candidate | null = null;

  for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex += 1) {
    const sheet = sheets[sheetIndex];
    if (!sheet) continue;

    for (let rectIndex = 0; rectIndex < sheet.free.length; rectIndex += 1) {
      const rect = sheet.free[rectIndex];
      if (!rect) continue;

      const orientations: readonly boolean[] = rotatable ? [false, true] : [false];

      for (const rotated of orientations) {
        const partW = rotated ? partWidth : partLength;
        const partH = rotated ? partLength : partWidth;
        if (partW > rect.w || partH > rect.h) continue;

        const dw = rect.w - partW;
        const dh = rect.h - partH;
        const candidate: Candidate = {
          sheet: sheetIndex,
          rect: rectIndex,
          rotated,
          partW,
          partH,
          shortSideLeftover: Math.min(dw, dh),
          longSideLeftover: Math.max(dw, dh),
          rectAreaMm2: rectArea(rect),
        };

        if (best === null || isBetter(candidate, best)) best = candidate;
      }
    }
  }

  return best;
}

function isBetter(candidate: Candidate, incumbent: Candidate): boolean {
  if (candidate.shortSideLeftover !== incumbent.shortSideLeftover) {
    return candidate.shortSideLeftover < incumbent.shortSideLeftover;
  }
  if (candidate.longSideLeftover !== incumbent.longSideLeftover) {
    return candidate.longSideLeftover < incumbent.longSideLeftover;
  }
  if (candidate.rectAreaMm2 !== incumbent.rectAreaMm2) {
    return candidate.rectAreaMm2 < incumbent.rectAreaMm2;
  }
  if (candidate.sheet !== incumbent.sheet) return candidate.sheet < incumbent.sheet;
  if (candidate.rect !== incumbent.rect) return candidate.rect < incumbent.rect;
  return candidate.rotated === false && incumbent.rotated === true;
}

/**
 * Splits the rectangle the part was placed in. The guillotine axis is chosen to
 * preserve the larger remainder, and kerf is deducted from the cut edge and the
 * perpendicular edge.
 */
function splitRect(rect: FreeRect, partW: number, partH: number, kerf: number): FreeRect[] {
  const dw = rect.w - partW;
  const dh = rect.h - partH;
  const result: FreeRect[] = [];

  if (dw <= dh) {
    // Vertical cut first: keep the tall strip on the right whole.
    const rightW = rect.w - partW - kerf;
    if (rightW > 0) result.push({ x: rect.x + partW + kerf, y: rect.y, w: rightW, h: rect.h });
    const belowH = rect.h - partH - kerf;
    if (belowH > 0) result.push({ x: rect.x, y: rect.y + partH + kerf, w: partW, h: belowH });
  } else {
    // Horizontal cut first: keep the wide strip on top whole.
    const topH = rect.h - partH - kerf;
    if (topH > 0) result.push({ x: rect.x, y: rect.y + partH + kerf, w: rect.w, h: topH });
    const rightW = rect.w - partW - kerf;
    if (rightW > 0) result.push({ x: rect.x + partW + kerf, y: rect.y, w: rightW, h: partH });
  }

  return result;
}

export function packParts(options: PackOptions): PackingResult {
  const {
    stock,
    parts,
    kerfMm,
    maxParts = DEFAULT_MAX_PARTS,
    maxStockInstances = DEFAULT_MAX_STOCK_INSTANCES,
  } = options;

  const kerf = Math.max(0, Math.round(kerfMm));

  // Expand stock into instances.
  const availableInstances: StockPiece[] = [];
  for (const piece of stock) {
    const count = Math.max(0, Math.floor(piece.quantity));
    for (let index = 1; index <= count; index += 1) {
      availableInstances.push(piece);
      if (availableInstances.length >= maxStockInstances) break;
    }
    if (availableInstances.length >= maxStockInstances) break;
  }

  // Expand parts into instances, largest first.
  const partInstances: PartToPack[] = [];
  for (const part of parts) {
    const count = Math.max(0, Math.floor(part.quantity));
    for (let index = 0; index < count; index += 1) partInstances.push(part);
  }

  const limitReached = partInstances.length > maxParts;
  if (limitReached) {
    const collapsed = collapseUnplaced(parts, 'Cutting layout exceeds the complexity limit.');
    return {
      placements: [],
      unplaced: collapsed,
      stockUsage: [],
      stockConsumed: 0,
      stockAvailable: availableInstances.length,
      totalStockAreaMm2: 0,
      usedAreaMm2: 0,
      wastePercent: 0,
      kerfMm: kerf,
      limitReached: true,
    };
  }

  partInstances.sort((a, b) => {
    const areaA = a.lengthMm * a.widthMm;
    const areaB = b.lengthMm * b.widthMm;
    if (areaB !== areaA) return areaB - areaA;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });

  const sheets: OpenSheet[] = [];
  const unplaced: UnplacedPart[] = [];
  let stockCursor = 0;

  for (const part of partInstances) {
    let candidate = findBestCandidate(sheets, part.lengthMm, part.widthMm, part.rotatable);

    // Open a fresh sheet only if the part fits nowhere already open. This keeps
    // sheet consumption low and therefore waste low.
    while (candidate === null && stockCursor < availableInstances.length) {
      const piece = availableInstances[stockCursor];
      stockCursor += 1;
      if (!piece) continue;

      const full: FreeRect = { x: 0, y: 0, w: piece.lengthMm, h: piece.widthMm };
      const free =
        piece.defectZones && piece.defectZones.length > 0
          ? applyDefects(full, piece.defectZones)
          : [full];

      sheets.push({
        stockId: piece.id,
        stockInstance: stockCursor,
        label: piece.label,
        lengthMm: piece.lengthMm,
        widthMm: piece.widthMm,
        free,
        placements: [],
        usedAreaMm2: 0,
      });

      const newSheetIndex = sheets.length - 1;
      candidate = findBestCandidate(
        sheets.slice(newSheetIndex),
        part.lengthMm,
        part.widthMm,
        part.rotatable,
      );
      // Translate the local index back to the global sheet index.
      if (candidate) candidate = { ...candidate, sheet: newSheetIndex + candidate.sheet };
    }

    if (candidate === null) {
      unplaced.push({
        partId: part.id,
        partName: part.name,
        quantity: 1,
        reason: 'No remaining stock area is large enough for this part without rotation.',
      });
      continue;
    }

    const sheet = sheets[candidate.sheet];
    const rect = sheet?.free[candidate.rect];
    if (!sheet || !rect) continue;

    sheet.free.splice(candidate.rect, 1);
    sheet.free.push(...splitRect(rect, candidate.partW, candidate.partH, kerf));
    sheet.placements.push({
      partId: part.id,
      partName: part.name,
      stockId: sheet.stockId,
      stockInstance: sheet.stockInstance,
      xMm: rect.x,
      yMm: rect.y,
      lengthMm: candidate.partW,
      widthMm: candidate.partH,
      rotated: candidate.rotated,
    });
    sheet.usedAreaMm2 += candidate.partW * candidate.partH;
  }

  const placements = sheets.flatMap((sheet) => sheet.placements);
  const usedAreaMm2 = sheets.reduce((total, sheet) => total + sheet.usedAreaMm2, 0);
  const totalStockAreaMm2 = sheets.reduce(
    (total, sheet) => total + sheet.lengthMm * sheet.widthMm,
    0,
  );
  const wastePercent =
    totalStockAreaMm2 > 0
      ? Math.round(((totalStockAreaMm2 - usedAreaMm2) / totalStockAreaMm2) * 10_000) / 100
      : 0;

  return {
    placements,
    unplaced: collapseUnplacedInstances(unplaced),
    stockUsage: sheets.map((sheet) => ({
      stockId: sheet.stockId,
      stockInstance: sheet.stockInstance,
      label: sheet.label,
      lengthMm: sheet.lengthMm,
      widthMm: sheet.widthMm,
      stockAreaMm2: sheet.lengthMm * sheet.widthMm,
      usedAreaMm2: sheet.usedAreaMm2,
      partCount: sheet.placements.length,
      placements: sheet.placements,
    })),
    stockConsumed: sheets.length,
    stockAvailable: availableInstances.length,
    totalStockAreaMm2,
    usedAreaMm2,
    wastePercent,
    kerfMm: kerf,
    limitReached: false,
  };
}

function collapseUnplaced(parts: readonly PartToPack[], reason: string): UnplacedPart[] {
  return parts
    .filter((part) => part.quantity > 0)
    .map((part) => ({
      partId: part.id,
      partName: part.name,
      quantity: part.quantity,
      reason,
    }));
}

function collapseUnplacedInstances(instances: readonly UnplacedPart[]): UnplacedPart[] {
  const grouped = new Map<string, UnplacedPart>();
  for (const instance of instances) {
    const existing = grouped.get(instance.partId);
    if (existing) {
      grouped.set(instance.partId, {...existing, quantity: existing.quantity + 1});
    } else {
      grouped.set(instance.partId, instance);
    }
  }
  return [...grouped.values()];
}

/** Total usable area of every stock piece, defect zones deducted. */
export function stockUsableAreaMm2(stock: readonly StockPiece[]): number {
  let total = 0;
  for (const piece of stock) {
    const gross = piece.lengthMm * piece.widthMm * piece.quantity;
    const defectArea = (piece.defectZones ?? []).reduce(
      (sum, zone) => sum + zone.widthMm * zone.heightMm,
      0,
    );
    total += Math.max(0, gross - defectArea * piece.quantity);
  }
  return total;
}

import { generateProductCandidates, explainFeasibility, type ResolvedCandidate } from '@/ai/service';
import { nowIso, SCHEMA_VERSION } from '@/domain/common';
import { newRequestId } from '@/domain/ids';
import { selectableTemplates } from '@/domain/catalog';
import type { ProcessId, ToolId } from '@/domain/catalog/types';
import { matchBuyers, type BuyerRequirement } from '@/domain/buyers/matching';
import type { BuyerSegmentId } from '@/domain/buyers/segments';
import { buildCostAssumptions, computeCost } from '@/domain/cost/engine';
import type { CostEstimate } from '@/domain/cost/types';
import {
  additionalMaterialsPerUnit as additionalMaterialsCost,
  materialCostPerUnit as materialCostInput,
} from '@/domain/evaluation/cost-inputs';
import { evaluateFeasibility } from '@/domain/feasibility/engine';
import type { FeasibilityResult, FeasibilityStatus } from '@/domain/feasibility/types';
import { isFeasible, isRankable } from '@/domain/feasibility/types';
import type { AuthContext } from '@/domain/identity/types';
import { assessMarket } from '@/domain/market/aggregate';
import type { MarketAssessment, MarketEvidence } from '@/domain/market/types';
import { familyOf, MATERIAL_CATEGORY_LABELS } from '@/domain/materials/types';
import type { Material, MaterialFamily } from '@/domain/materials/types';
import type {
  CostEstimateDocument,
  FeasibilityResultDocument,
  OpportunityDocument,
} from '@/domain/opportunity/types';
import { rankOpportunities, type OpportunitySignals, type RankedOpportunity } from '@/domain/ranking/rank';

import { serverConfig } from '@/lib/config';

import { listMarketEvidence, listMatchableRequirements, type BuyerRequirementDocument } from '../repos/evidence';
import { saveCostEstimate, saveFeasibilityResult, saveOpportunityDocuments } from '../repos/opportunities';

/**
 * The discovery pipeline.
 *
 * Order matters, and the order is the product:
 *
 *   candidates (AI, bound to a curated catalogue)
 *     -> feasibility gates (deterministic, may reject outright)
 *       -> cost (deterministic, integer minor units)
 *         -> market evidence (may be absent; never invented)
 *           -> buyer matching (segments are hypotheses, registered demand is not)
 *             -> ranking (hard gates first; unknowns stay unknown)
 *
 * Nothing after the candidate step trusts the model, and no step re-reads a number
 * from the model.
 */

export interface CapabilitySummary {
  readonly name: string;
  readonly tools: readonly ToolId[];
  readonly processes: readonly ProcessId[];
  readonly supportedFamilies: readonly MaterialFamily[];
}

export interface EvaluateMaterialInput {
  readonly auth: AuthContext;
  readonly material: Material;
  readonly capability: CapabilitySummary | null;
  readonly overrides?: Partial<Record<string, number>>;
  readonly targetMarket?: string | null;
  readonly isSampleData?: boolean;
}

export interface EvaluateMaterialResult {
  readonly opportunities: readonly OpportunityDocument[];
  readonly feasibility: readonly FeasibilityResultDocument[];
  readonly cost: readonly CostEstimateDocument[];
  readonly notes: readonly string[];
  readonly dropped: readonly { label: string; reason: string }[];
}

/** Sample reference price for reclaimed sheet, in minor units per m². */
function familyOfMaterial(material: Material): MaterialFamily {
  return familyOf(material.attributes.category);
}

function categoryOfCandidate(candidate: ResolvedCandidate): OpportunityDocument['category'] {
  return candidate.kind === 'template' ? candidate.template.category : 'storage';
}

function idOfCandidate(candidate: ResolvedCandidate): string {
  return candidate.kind === 'template' ? candidate.templateId : candidate.name;
}

function nameOfCandidate(candidate: ResolvedCandidate): string {
  return candidate.kind === 'template' ? candidate.template.name : candidate.name;
}

function additionalMaterialsPerUnit(feasibility: FeasibilityResult): number {
  return additionalMaterialsCost(feasibility);
}

function toBuyerRequirement(document: BuyerRequirementDocument): BuyerRequirement {
  return {
    id: document.id,
    buyerKind: document.buyerKind,
    businessName: document.businessName,
    industry: document.industry,
    location: document.location,
    country: document.country,
    productCategories: document.productCategories,
    materialFamilies: document.materialFamilies,
    minOrderQuantity: document.minOrderQuantity,
    budgetMinMinor: document.budgetMinMinor,
    budgetMaxMinor: document.budgetMaxMinor,
    currency: document.currency,
    capacityNote: document.capacityNote,
    consentToMatch: document.consentToMatch,
    verified: document.verified,
  };
}

interface EvaluatedCandidate {
  readonly opportunityId: string;
  readonly candidate: ResolvedCandidate;
  readonly feasibility: FeasibilityResult | null;
  readonly status: FeasibilityStatus;
  readonly cost: CostEstimate | null;
  readonly market: MarketAssessment;
  readonly buyerMatches: ReturnType<typeof matchBuyers>;
  readonly signals: OpportunitySignals;
  readonly feasibilityDocument: FeasibilityResultDocument | null;
  readonly costDocument: CostEstimateDocument | null;
}

export async function evaluateMaterial(
  input: EvaluateMaterialInput,
): Promise<EvaluateMaterialResult> {
  const { material, auth } = input;
  const family = familyOfMaterial(material);
  const notes: string[] = [];

  const candidateOutcome = await generateProductCandidates({
    materialFamily: family,
    materialCategory: material.attributes.category,
    materialSubtype: material.attributes.subtype,
    condition: material.attributes.condition,
    lengthMm: material.dimensions.lengthMm ?? 0,
    widthMm: material.dimensions.widthMm ?? 0,
    thicknessMm: material.dimensions.thicknessMm,
    sheetCount: material.quantity.value,
    availableAreaM2:
      ((material.dimensions.lengthMm ?? 0) / 1000) *
      ((material.dimensions.widthMm ?? 0) / 1000) *
      material.quantity.value,
    templates: selectableTemplates([family]),
    toolsAvailable: input.capability ? [...input.capability.tools] : [],
    targetMarket: input.targetMarket ?? null,
    budget: { maxCandidates: serverConfig.ai.maxCandidates },
  });

  notes.push(...candidateOutcome.notes);

  // Requirements are loaded once per distinct product category, not once per
  // candidate, so a five-candidate run costs at most five queries.
  const categories = [
    ...new Set(candidateOutcome.candidates.map((candidate) => categoryOfCandidate(candidate))),
  ];
  const marketRowsByCategory = new Map<OpportunityDocument['category'], MarketEvidence[]>();
  const requirementsByCategory = new Map<OpportunityDocument['category'], BuyerRequirement[]>();

  for (const category of categories) {
    const [rows, requirements] = await Promise.all([
      listMarketEvidence(category),
      listMatchableRequirements(category),
    ]);
    marketRowsByCategory.set(category, rows);
    requirementsByCategory.set(category, requirements.map(toBuyerRequirement));
  }

  const evaluated: EvaluatedCandidate[] = [];

  for (const candidate of candidateOutcome.candidates) {
    const category = categoryOfCandidate(candidate);
    const opportunityId = newRequestId();

    const feasibility =
      candidate.kind === 'template'
        ? evaluateFeasibility({
            template: candidate.template,
            parameters: candidate.parameters,
            material: {
              category: material.attributes.category,
              lengthMm: material.dimensions.lengthMm,
              widthMm: material.dimensions.widthMm,
              thicknessMm: material.dimensions.thicknessMm,
              quantityValue: material.quantity.value,
              quantityUnit: material.quantity.unit,
              reservedQuantity: material.availability.reservedQuantity,
              condition: material.attributes.condition,
              contamination: material.attributes.contamination,
              defects: material.attributes.defects,
              // Only a confirmed material can produce a feasibility verdict.
              verified: material.status === 'verified',
            },
            capability: input.capability,
          })
        : null;

    const status: FeasibilityStatus = feasibility?.status ?? 'not_evaluated';

    const market = assessMarket(marketRowsByCategory.get(category) ?? [], {
      category,
      currency: auth.currency,
      region: auth.country,
    });

    let cost: CostEstimate | null = null;
    if (feasibility && feasibility.capacity.maxUnits > 0) {
      const materialCost = materialCostInput(feasibility);
      const { assumptions } = buildCostAssumptions({
        currency: auth.currency,
        labourMinutesPerUnit:
          candidate.kind === 'template' ? candidate.template.labourMinutesPerUnit : 20,
        additionalMaterialsPerUnitMinor: additionalMaterialsPerUnit(feasibility),
        materialCostPerUnitMinor: materialCost.amountMinor,
        ...(input.overrides ? { overrides: input.overrides } : {}),
      });

      cost = computeCost({
        assumptions,
        priceBands: market.bands,
        hints: { material: materialCost.basis },
      });
    }

    const referencePriceMinor = market.bands?.referenceMinor ?? null;
    const referenceScenario = cost?.scenarios.find((scenario) => scenario.id === 'reference') ?? null;

    const buyerMatches = matchBuyers(requirementsByCategory.get(category) ?? [], {
      templateId: idOfCandidate(candidate),
      category,
      materialFamilies: [family],
      materialFamily: family,
      complexity: candidate.kind === 'template' ? candidate.template.complexity : 'medium',
      maxUnits: feasibility?.capacity.maxUnits ?? 0,
      currency: auth.currency,
      region: auth.country,
      referencePriceMinor,
      segmentIds:
        candidate.kind === 'template' ? candidate.targetSegments : ([] as readonly BuyerSegmentId[]),
    });

    evaluated.push({
      opportunityId,
      candidate,
      feasibility,
      status,
      cost,
      market,
      buyerMatches,
      feasibilityDocument: feasibility
        ? {
            ...feasibility,
            id: opportunityId,
            orgId: auth.orgId,
            opportunityId,
            materialId: material.id,
            schemaVersion: SCHEMA_VERSION,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }
        : null,
      costDocument: cost
        ? {
            ...cost,
            id: opportunityId,
            orgId: auth.orgId,
            opportunityId,
            schemaVersion: SCHEMA_VERSION,
            createdBy: auth.uid,
            updatedAt: nowIso(),
          }
        : null,
      signals: {
        id: opportunityId,
        label: nameOfCandidate(candidate),
        feasibilityStatus: status,
        contributionPerUnitMinor: referenceScenario?.contributionPerUnitMinor ?? null,
        unitCostMinor: cost?.unitCostMinor ?? null,
        referencePriceMinor,
        materialUtilisationPercent:
          feasibility !== null ? Math.max(0, 100 - feasibility.capacity.wastePercent) : null,
        buyerScore: buyerMatches.bestScore,
        evidenceQuality: market.quality,
        complexity: candidate.kind === 'template' ? candidate.template.complexity : null,
        maxUnits: feasibility?.capacity.maxUnits ?? 0,
      },
    });
  }

  const ranked = rankOpportunities(evaluated.map((entry) => entry.signals));
  const rankedById = new Map(ranked.map((entry) => [entry.id, entry]));

  const opportunities = evaluated.map((entry) =>
    buildOpportunityDocument({
      input,
      entry,
      ranked: rankedById.get(entry.opportunityId) ?? null,
    }),
  );

  const notRankable = evaluated.filter((entry) => !isRankable(entry.status)).length;
  if (notRankable > 0) {
    notes.push(
      `${notRankable} candidate(s) failed a hard constraint or could not be evaluated. They are ` +
        'listed after the viable ones and are never ranked above them.',
    );
  }
  if (evaluated.length > 0 && evaluated.every((entry) => entry.market.bands === null)) {
    notes.push(
      'No market evidence exists for these product categories, so no selling price is estimated. ' +
        'Insufficient Market Data is reported instead.',
    );
  }
  if (evaluated.some((entry) => isFeasible(entry.status))) {
    notes.push(
      'Feasible results are conservative 2D nesting estimates under the stated assumptions. They are ' +
        'not production drawings and not safety certifications.',
    );
  }
  if (candidateOutcome.dropped.length > 0) {
    notes.push(
      `${candidateOutcome.dropped.length} suggested product(s) were rejected before evaluation ` +
        'because they could not be substantiated from the catalogue.',
    );
  }

  return {
    opportunities,
    feasibility: evaluated
      .map((entry) => entry.feasibilityDocument)
      .filter((document): document is FeasibilityResultDocument => document !== null),
    cost: evaluated
      .map((entry) => entry.costDocument)
      .filter((document): document is CostEstimateDocument => document !== null),
    notes,
    dropped: candidateOutcome.dropped,
  };
}

interface BuildOpportunityParams {
  readonly input: EvaluateMaterialInput;
  readonly entry: EvaluatedCandidate;
  readonly ranked: RankedOpportunity | null;
}

function buildOpportunityDocument({ input, entry, ranked }: BuildOpportunityParams): OpportunityDocument {
  const { candidate, feasibility, cost, market, buyerMatches } = entry;
  const referenceScenario = cost?.scenarios.find((scenario) => scenario.id === 'reference') ?? null;
  const timestamp = nowIso();

  return {
    id: entry.opportunityId,
    orgId: input.auth.orgId,
    schemaVersion: SCHEMA_VERSION,
    materialId: input.material.id,
    materialSnapshot: {
      title: input.material.title,
      category: input.material.attributes.category,
      family: familyOfMaterial(input.material),
      lengthMm: input.material.dimensions.lengthMm ?? 0,
      widthMm: input.material.dimensions.widthMm ?? 0,
      thicknessMm: input.material.dimensions.thicknessMm,
      sheetCount: input.material.quantity.value,
      condition: input.material.attributes.condition,
    },
    kind: candidate.kind,
    templateId: candidate.kind === 'template' ? candidate.templateId : null,
    productName: nameOfCandidate(candidate),
    category: categoryOfCandidate(candidate),
    validationLevel: candidate.kind === 'template' ? candidate.template.validationLevel : 'concept',
    concept:
      candidate.kind === 'concept'
        ? {
            name: candidate.name,
            description: candidate.description,
            rationale: candidate.rationale,
          }
        : null,
    parameters: candidate.kind === 'template' ? candidate.parameters : {},
    feasibilityStatus: entry.status,
    summary: {
      maxUnits: feasibility?.capacity.maxUnits ?? 0,
      unitCostMinor: cost?.unitCostMinor ?? null,
      currency: input.auth.currency,
      minViablePriceMinor: cost?.minViablePricePerUnitMinor ?? null,
      referencePriceMinor: market.bands?.referenceMinor ?? null,
      contributionPerUnitMinor: referenceScenario?.contributionPerUnitMinor ?? null,
      contributionMarginBps: referenceScenario?.contributionMarginBps ?? null,
      wastePercent: feasibility?.capacity.wastePercent ?? null,
      evidenceQuality: market.quality,
      bestBuyerScore: buyerMatches.bestScore,
      targetSegments: candidate.kind === 'template' ? candidate.targetSegments : [],
      shortfallDetected: buyerMatches.shortfallDetected,
    },
    rank: ranked?.rank ?? Number.MAX_SAFE_INTEGER,
    ranking: ranked
      ? {
          rank: ranked.rank,
          score: ranked.score,
          gatesPassed: ranked.gatesPassed,
          gateReasons: ranked.gateReasons,
          unknownDimensions: ranked.unknownDimensions,
          dimensions: ranked.dimensions.map((dimension) => ({
            id: dimension.id,
            label: dimension.label,
            value: dimension.value,
            weight: dimension.weight,
            explanation: dimension.explanation,
          })),
          summary: ranked.summary,
        }
      : null,
    buyerMatches: [...buyerMatches.potentialSegments, ...buyerMatches.verifiedRequests],
    explanation: null,
    reasons: buildReasons(entry),
    risks: buildRisks(entry, input.material),
    nextActions: buildNextActions(entry, candidate),
    saved: false,
    savedAt: null,
    isSampleData: input.isSampleData ?? false,
    createdBy: input.auth.uid,
    evaluatedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildReasons(entry: EvaluatedCandidate): string[] {
  const reasons: string[] = [entry.candidate.rationale];

  if (entry.candidate.kind === 'concept') {
    reasons.push(
      'Concept only. No validated manufacturing specification exists for this idea, so it has not ' +
        'been costed, nested or checked against real tooling.',
    );
  }

  if (entry.feasibility) {
    reasons.push(
      `${entry.feasibility.capacity.maxUnits} unit(s) fit ${entry.feasibility.capacity.sheetsRequired} ` +
        `sheet(s) with ${entry.feasibility.capacity.wastePercent}% cutting waste.`,
    );
    if (entry.feasibility.limitingFactor) reasons.push(entry.feasibility.limitingFactor);
    reasons.push(...entry.feasibility.rejectReasons);
  }

  reasons.push(
    entry.market.bands
      ? entry.market.basis
      : 'Insufficient Market Data: no price evidence exists for this product category, so no ' +
        'selling price is estimated.',
  );

  if (entry.buyerMatches.verifiedRequests.length > 0) {
    reasons.push(
      `${entry.buyerMatches.verifiedRequests.length} registered buyer request(s) match this product.`,
    );
  }

  return [...new Set(reasons.filter((reason) => reason.trim().length > 0))];
}

function buildRisks(entry: EvaluatedCandidate, material: Material): string[] {
  const risks = [...entry.candidate.risks];

  if (entry.feasibility) {
    risks.push(...entry.feasibility.warnings);
    if (!isFeasible(entry.status)) risks.push(...entry.feasibility.rejectReasons);
  }

  risks.push(...entry.market.caveats);

  if (entry.buyerMatches.shortfallDetected) {
    risks.push(
      'A registered buyer wants more units than the available material can produce. This order ' +
        'cannot be met from this material alone.',
    );
  }

  risks.push(
    `The material is ${MATERIAL_CATEGORY_LABELS[
      material.attributes.category
    ].toLowerCase()} in the recorded condition. Inspect it physically before committing material.`,
  );

  return [...new Set(risks)];
}

function buildNextActions(entry: EvaluatedCandidate, candidate: ResolvedCandidate): string[] {
  if (!isFeasible(entry.status)) {
    return [
      'Try a smaller product variation, or adjust the sheet size, then re-run discovery.',
      'Confirm the material dimensions and quantity; an unconfirmed value blocks evaluation.',
    ];
  }

  const actions: string[] = [];

  if (!entry.market.bands) {
    actions.push(
      'Ask two or three potential buyers what they would pay, and record it as evidence for this ' +
        'category.',
    );
  } else {
    actions.push('Replace the sample cost assumptions with your own workshop numbers.');
  }

  actions.push('Check the cutting layout, then cut one sample unit before committing material.');
  actions.push(
    candidate.kind === 'template'
      ? 'Save this to the workspace and record the production outcome once it runs.'
      : 'Commission a manufacturing specification before offering this to a buyer.',
  );

  return actions;
}

/**
 * Prose explanation for one opportunity, generated after ranking.
 *
 * The model receives figures the engines already computed and is forbidden from
 * recalculating them. A failure here is swallowed on purpose: an explanation is a
 * nice-to-have, and discovery must never fail because prose did.
 */
export async function attachExplanation(
  opportunity: OpportunityDocument,
  feasibility: FeasibilityResultDocument | null,
): Promise<OpportunityDocument['explanation']> {
  try {
    const { explanation } = await explainFeasibility({
      productName: opportunity.productName,
      materialSummary:
        `${opportunity.materialSnapshot.title} ` +
        `(${opportunity.materialSnapshot.lengthMm} x ${opportunity.materialSnapshot.widthMm} mm, ` +
        `${opportunity.materialSnapshot.sheetCount} sheet(s))`,
      statusLabel: opportunity.feasibilityStatus,
      checks: (feasibility?.checks ?? []).map((check) => ({
        label: check.label,
        outcome: check.outcome,
        detail: check.detail,
      })),
      rejectReasons: feasibility?.rejectReasons ?? [],
      warnings: feasibility?.warnings ?? [],
      assumptions: feasibility?.assumptions ?? [],
      maxUnits: opportunity.summary.maxUnits,
      wastePercent: opportunity.summary.wastePercent ?? 0,
      unitCostMinor: opportunity.summary.unitCostMinor,
      currency: opportunity.summary.currency,
      disclaimer: feasibility?.disclaimer ?? '',
    });

    return {
      summary: explanation.summary,
      keyPoints: explanation.keyPoints,
      caveats: explanation.caveats,
      nextActions: explanation.nextActions,
    };
  } catch {
    return null;
  }
}

export { saveCostEstimate, saveFeasibilityResult, saveOpportunityDocuments };

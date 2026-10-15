import type { ProductTemplate } from '@/domain/catalog/types';
import type { MaterialCategory, MaterialFamily } from '@/domain/materials/types';

import type { AiImage } from './client';
import type { DiscoveryPromptContext } from './prompts/discovery';
import type {
  BuyerPromptContext,
  FeasibilityPromptContext,
  OpportunitySummaryPromptContext,
} from './prompts/explanation';
import type { MaterialPromptContext } from './prompts/material';

/** Inputs accepted by the AI service, shared with the mock adapter. */
export interface MaterialAnalysisInput extends MaterialPromptContext {
  readonly images: readonly AiImage[];
  /**
   * Used by the mock adapter only. A live model must determine the category from
   * the photographs, so this never reaches the prompt.
   */
  readonly categoryHint?: MaterialCategory;
}

export type DiscoveryInput = DiscoveryPromptContext;
export type FeasibilityExplanationInput = FeasibilityPromptContext;
export type BuyerSegmentsInput = BuyerPromptContext;
export type OpportunitySummaryInput = OpportunitySummaryPromptContext;

export interface DiscoveryMaterialFacts {
  readonly family: MaterialFamily;
  readonly category: MaterialCategory;
}

/** Template subset offered to the model, used to validate its selection. */
export type AllowedTemplates = readonly ProductTemplate[];

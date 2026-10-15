/**
 * Wire contracts shared between the server routes and the browser client.
 *
 * Declared separately from the server implementation so a client component never
 * imports server-only code just to learn the shape of a response.
 */

export interface ApiMeta {
  readonly requestId: string;
}

export interface ApiSuccessBody<T> {
  readonly data: T;
  readonly meta: ApiMeta;
}

export interface ApiFailureBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details: Record<string, unknown>;
  };
  readonly meta: ApiMeta;
}

export interface MaterialListResponse {
  readonly items: readonly MaterialListItem[];
  readonly nextCursor: string | null;
}

export interface MaterialListItem {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly condition: string;
  readonly status: string;
  readonly dimensions: {
    readonly lengthMm: number | null;
    readonly widthMm: number | null;
    readonly thicknessMm: number | null;
  };
  readonly quantity: { readonly value: number; readonly unit: string };
  readonly availableQuantity: number;
  readonly reservedQuantity: number;
  readonly photoCount: number;
  readonly isSampleData: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StartingAnalysis {
  readonly jobId: string;
  readonly status: string;
  readonly cached: boolean;
}

export interface AnalysisProgress {
  readonly job: {
    readonly id: string;
    readonly materialId: string;
    readonly status: 'queued' | 'running' | 'succeeded' | 'failed';
    readonly mock: boolean;
    readonly model: string;
    readonly attempts: number;
    readonly createdAt: string;
    readonly startedAt: string | null;
    readonly finishedAt: string | null;
  };
  readonly output: unknown;
  readonly unsupportedClaims: readonly string[];
  readonly error: { code: string; message: string; details: readonly string[] } | null;
}

export interface UploadTarget {
  readonly materialId: string;
  readonly uploadPathPrefix: string;
}

/**
 * Typed AI failures.
 *
 * Every failure mode named in the product requirements has a code here, so the
 * HTTP layer can map it to a stable machine-readable application error and the UI
 * can choose a sensible recovery: retry, degrade to manual entry, or explain.
 */

export type AiErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_OUTPUT'
  | 'AI_UNSAFE_RECOMMENDATION'
  | 'AI_QUOTA_EXCEEDED';

export interface AiErrorOptions {
  readonly details?: readonly string[];
  readonly retryable?: boolean;
  /**
   * Named `causeDetail` rather than `cause` so it does not collide with the
   * built-in `Error.cause`, which is typed `unknown`.
   */
  readonly causeDetail?: string | undefined;
}

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly details: readonly string[];
  readonly retryable: boolean;
  readonly causeDetail?: string | undefined;

  constructor(code: AiErrorCode, message: string, options: AiErrorOptions = {}) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.details = options.details ?? [];
    this.retryable = options.retryable ?? false;
    if (options.causeDetail !== undefined) this.causeDetail = options.causeDetail;
  }
}

/** Whether the user-facing flow can continue without AI. */
export function isDegradable(code: AiErrorCode): boolean {
  return code !== 'AI_QUOTA_EXCEEDED';
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED:
    'No AI model is configured, so material analysis is unavailable. You can still enter the ' +
    'material properties by hand and continue.',
  AI_TIMEOUT: 'The AI request took too long and was stopped. Try again, or enter the properties manually.',
  AI_RATE_LIMITED: 'The AI service is rate limiting this account. Wait a moment and try again.',
  AI_UNAVAILABLE:
    'The AI service could not be reached. You can still discover products by confirming the ' +
    'material properties manually.',
  AI_INVALID_OUTPUT:
    'The AI returned a response that did not match the required structure, so it was discarded. ' +
    'Nothing unvalidated was saved.',
  AI_UNSAFE_RECOMMENDATION:
    'The AI recommendation was rejected because it asserted something a photograph cannot ' +
    'establish.',
  AI_QUOTA_EXCEEDED: 'The daily AI allowance for this account has been used. It resets tomorrow.',
};

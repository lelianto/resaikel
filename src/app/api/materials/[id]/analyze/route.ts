import { after } from 'next/server';

import { HttpError } from '@/server/http/errors';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonAccepted, jsonOk } from '@/server/http/response';
import { runAnalysisJob, startMaterialAnalysis } from '@/server/services/analysis';

/**
 * POST /api/materials/:id/analyze
 *
 * Returns 202 with a job id immediately - never a promise detached from the
 * response. The worker is then registered with `after()`, which runs inside the
 * request lifecycle, and the client polls `GET /api/analysis/:jobId`.
 *
 * A cache hit returns 200 with the existing result, because there is nothing to
 * wait for and nothing new to bill.
 */
export const POST = authedRoute<{ id: string }>(async ({ auth, params, requestId }) => {
  await enforceRateLimit(auth, 'ai');

  const { job, cached } = await startMaterialAnalysis(auth, params.id);

  if (cached) {
    return jsonOk({ jobId: job.id, status: job.status, cached: true, mock: job.mock }, requestId);
  }

  if (job.status === 'queued') {
    // Registered work, not fire-and-forget: `after` keeps it inside the request's
    // lifecycle. If it still fails, the polling endpoint re-claims the job.
    after(async () => {
      await runAnalysisJob(job.id);
    });
  }

  return jsonAccepted({ jobId: job.id, status: job.status, cached: false }, requestId);
});

export function GET(): never {
  throw new HttpError('INVALID_INPUT', 'Use POST to start an analysis and GET /api/analysis/:jobId to poll it.');
}

import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk } from '@/server/http/response';
import { getAnalysisJobForRequest } from '@/server/services/analysis';

/**
 * GET /api/analysis/:jobId
 *
 * Poll endpoint. If the job is still queued, or its claim went stale because a
 * worker died mid-flight, the work is re-claimed and run here - which is what
 * makes the pipeline self-healing rather than dependent on a single in-process
 * invocation surviving.
 */
export const GET = authedRoute<{ jobId: string }>(async ({ auth, params, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const job = await getAnalysisJobForRequest(auth, params.jobId);

  return jsonOk(
    {
      job: {
        id: job.id,
        materialId: job.materialId,
        status: job.status,
        mock: job.mock,
        model: job.model,
        attempts: job.attempts,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      },
      output: job.output,
      unsupportedClaims: job.unsupportedClaims,
      error: job.error,
      usage: job.usage,
    },
    requestId,
  );
});

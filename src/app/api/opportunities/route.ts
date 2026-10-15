import { enforceRateLimit } from '@/server/http/ratelimit';
import { authedRoute, jsonOk } from '@/server/http/response';
import {
  countOpportunities,
  listOpportunityDocuments,
} from '@/server/repos/opportunities';

/**
 * GET /api/opportunities
 *
 * The comparison screen's data source. One query, because every number the grid
 * renders was denormalised onto the opportunity when discovery ran.
 */
export const GET = authedRoute(async ({ auth, request, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const savedOnly = request.nextUrl.searchParams.get('saved') === 'true';
  const materialId = request.nextUrl.searchParams.get('materialId');
  const cursor = request.nextUrl.searchParams.get('cursor');
  const limitParam = request.nextUrl.searchParams.get('limit');

  const result = await listOpportunityDocuments(auth.orgId, {
    savedOnly,
    materialId,
    cursor,
    limit: limitParam ? Number(limitParam) : undefined,
  });

  const total = await countOpportunities(auth.orgId, savedOnly);

  return jsonOk(
    {
      items: result.items,
      nextCursor: result.nextCursor,
      total,
      savedOnly,
    },
    requestId,
  );
});

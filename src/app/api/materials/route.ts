import { materialCreateSchema } from '@/server/http/schemas';
import { jsonOk, authedRoute, readJson } from '@/server/http/response';
import { enforceRateLimit } from '@/server/http/ratelimit';
import { buildMaterialDocument, newMaterialId } from '@/server/services/materials';
import { createMaterialDocument, listMaterialDocuments } from '@/server/repos/materials';
import { recordAuditEvent } from '@/server/repos/identity';

/** GET /api/materials - the organisation's inventory, newest first, paginated. */
export const GET = authedRoute(async ({ auth, request, requestId }) => {
  await enforceRateLimit(auth, 'api');

  const statusParam = request.nextUrl.searchParams.get('status');
  const cursor = request.nextUrl.searchParams.get('cursor');
  const limitParam = request.nextUrl.searchParams.get('limit');

  const result = await listMaterialDocuments(auth.orgId, {
    status: statusParam && statusParam !== 'all' ? (statusParam as never) : null,
    cursor,
    limit: limitParam ? Number(limitParam) : undefined,
  });

  return jsonOk(
    {
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.attributes.category,
        condition: item.attributes.condition,
        status: item.status,
        dimensions: item.dimensions,
        quantity: item.quantity,
        availableQuantity: item.availability.availableQuantity,
        reservedQuantity: item.availability.reservedQuantity,
        photoCount: item.photoCount,
        primaryPhotoId: item.primaryPhotoId,
        isSampleData: item.isSampleData,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      nextCursor: result.nextCursor,
    },
    requestId,
  );
});

/** POST /api/materials - create a draft material before its photographs land. */
export const POST = authedRoute(async ({ auth, request, requestId }) => {
  await enforceRateLimit(auth, 'api');
  const body = await readJson(request, materialCreateSchema);

  const materialId = newMaterialId();
  const document = buildMaterialDocument({
    auth,
    materialId,
    title: body.title,
    origin: body.origin ?? null,
    notes: body.notes ?? null,
    category: body.category,
    condition: body.condition,
    contamination: body.contamination,
    defects: body.defects,
    quantityValue: body.quantityValue,
    quantityUnit: body.quantityUnit,
    lengthMm: body.lengthMm ?? null,
    widthMm: body.widthMm ?? null,
    thicknessMm: body.thicknessMm ?? null,
    isSampleData: body.isSampleData,
  });

  await createMaterialDocument(document);
  await recordAuditEvent({
    orgId: auth.orgId,
    actorUid: auth.uid,
    action: 'material.created',
    entity: 'material',
    entityId: materialId,
    meta: { category: body.category, isSampleData: body.isSampleData },
  });

  return jsonOk({ material: document, uploadPathPrefix: `materials/${auth.orgId}/${materialId}` }, requestId, 201);
});

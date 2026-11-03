import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"
import { withWithdrawalMarks } from "../../../workflows/returns/request-items"
import type { AdminGetReturnRequestsType } from "./validators"
import { returnRequestView } from "./view"

/**
 * GET /admin/return-requests (F7.9, adr/0032): shoppers' requests, the
 * oldest waiting first, each with its order's number; refunds as lira;
 * an exchange's wanted variants by name (§6); each line marked when it is
 * outside the right of withdrawal, as `/admin/orders/:id/returnable` marks it.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetReturnRequestsType>,
  res: MedusaResponse
): Promise<void> {
  const { status, order_id, limit, offset } = req.validatedQuery
  const [requests, count] = await req.scope
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listAndCountReturnRequests(
      { ...(status ? { status } : {}), ...(order_id ? { order_id } : {}) },
      { take: limit, skip: offset, order: { created_at: status === "requested" ? "ASC" : "DESC" } }
    )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const swaps = (request: { exchange_items: unknown }) =>
    (request.exchange_items ?? []) as { line_item_id: string; variant_id: string }[]
  const variantIds = [...new Set(requests.flatMap(swaps).map((line) => line.variant_id))]
  const [{ data: orders }, { data: variants }, marked] = await Promise.all([
    query.graph({
      entity: "order",
      fields: ["id", "display_id"],
      filters: { id: [...new Set(requests.map((request) => request.order_id))] },
    }),
    variantIds.length
      ? query.graph({
          entity: "product_variant",
          fields: ["id", "title"],
          filters: { id: variantIds },
        })
      : Promise.resolve({ data: [] as unknown[] }),
    withWithdrawalMarks(req.scope, requests),
  ])
  const titles = new Map(
    (variants as { id: string; title?: string | null }[]).map((variant) => [
      variant.id,
      variant.title ?? null,
    ])
  )
  const numbers = new Map(
    (orders as unknown as { id: string; display_id: number }[]).map((order) => [
      order.id,
      order.display_id,
    ])
  )
  res.json({
    return_requests: marked.map((request) => ({
      ...returnRequestView(request),
      exchange_items:
        request.kind === "exchange"
          ? swaps(request).map((line) => ({ ...line, title: titles.get(line.variant_id) ?? null }))
          : null,
      order_display_id: numbers.get(request.order_id) ?? null,
    })),
    count,
    limit,
    offset,
  })
}

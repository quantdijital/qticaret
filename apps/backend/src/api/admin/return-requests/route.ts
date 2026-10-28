import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { kurus, toMedusaAmount } from "../../../lib/money"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"
import type { AdminGetReturnRequestsType } from "./validators"

/**
 * GET /admin/return-requests (F7.9, adr/0032): shoppers' requests, the
 * oldest waiting first, each with its order's number; refunds as lira.
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
  const { data: orders } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: [...new Set(requests.map((request) => request.order_id))] },
  })
  const numbers = new Map(
    (orders as unknown as { id: string; display_id: number }[]).map((order) => [
      order.id,
      order.display_id,
    ])
  )
  res.json({
    return_requests: requests.map((request) => ({
      ...request,
      refund_amount:
        request.refund_amount === null ? null : toMedusaAmount(kurus(request.refund_amount)),
      order_display_id: numbers.get(request.order_id) ?? null,
    })),
    count,
    limit,
    offset,
  })
}

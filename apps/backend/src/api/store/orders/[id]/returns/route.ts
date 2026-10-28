import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { RETURN_REQUESTS_MODULE } from "../../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../../modules/return-requests/service"
import { requestReturn } from "../../../../../workflows/returns/request-return"
import type { StorePostReturnRequestType } from "../../../../admin/return-requests/validators"

/** What a shopper sees of their request: its state and the carrier's code, never staff notes' authors. */
const view = (request: Record<string, unknown>) => ({
  id: request["id"],
  status: request["status"],
  reason: request["reason"],
  items: request["items"],
  return_code: request["return_code"],
  decision_note: request["decision_note"],
  created_at: request["created_at"],
})

/** POST /store/orders/:id/returns (F7.9): the signed-in shopper asks to send lines back. */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostReturnRequestType>,
  res: MedusaResponse
): Promise<void> {
  const { items, reason, note } = req.validatedBody
  const created = await requestReturn(req.scope, {
    order_id: req.params["id"] ?? "",
    customer_id: req.auth_context.actor_id,
    items,
    reason,
    note: note ?? null,
  })
  res.json({ return_request: view(created) })
}

/** GET /store/orders/:id/returns: the shopper's requests on their own order. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params["id"] ?? ""
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["customer_id"],
    filters: { id: orderId },
  })
  if (
    (data[0] as { customer_id?: string | null } | undefined)?.customer_id !==
    req.auth_context.actor_id
  ) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  const requests = await req.scope
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests({ order_id: orderId }, { order: { created_at: "DESC" } })
  res.json({
    return_requests: requests.map((request) => view(request as unknown as Record<string, unknown>)),
  })
}

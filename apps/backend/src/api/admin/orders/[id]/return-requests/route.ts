import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { requestReturn } from "../../../../../workflows/returns/request-return"
import type { StorePostReturnRequestType } from "../../../return-requests/validators"

/**
 * POST /admin/orders/:id/return-requests (F12.3): staff ask back, for the
 * shopper who called, what the shopper could ask themselves: the same
 * window, lines and exchange rules, and the same e-mail to the shopper.
 * It then waits in the returns queue like any other (adr/0032).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostReturnRequestType>,
  res: MedusaResponse
): Promise<void> {
  const orderId = req.params["id"] ?? ""
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "customer_id"],
    filters: { id: orderId },
  })
  const order = data[0] as { customer_id?: string | null } | undefined
  if (!order?.customer_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  const { kind, items, reason, note } = req.validatedBody
  const created = await requestReturn(req.scope, {
    order_id: orderId,
    customer_id: order.customer_id,
    kind,
    items,
    reason,
    note: note ?? null,
  })
  res.status(201).json({ return_request: { id: created.id, status: created.status, kind } })
}

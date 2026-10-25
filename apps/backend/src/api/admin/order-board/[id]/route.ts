import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, ORDER_STATE_FIELDS, orderState } from "../../../../lib/dashboard"
import type { StateOrder } from "../../../../lib/dashboard"

/**
 * One order's stage and what can be done next (adr/0022): the panel shows
 * these actions as they are, so it and the server agree. No personal data.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [...LIFECYCLE_FIELDS, ...ORDER_STATE_FIELDS],
    filters: { id: req.params["id"] ?? "" },
  })
  const order = data[0] as StateOrder | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  res.json(orderState(order))
}

import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, ORDER_STATE_FIELDS, orderState } from "../../../../lib/dashboard"
import type { StateOrder } from "../../../../lib/dashboard"
import { shipsWithTestCarrier } from "../../../../workflows/orders/test-shipping"

/**
 * One order's stage and what can be done next (adr/0022): the panel shows
 * these actions as they are, so it and the server agree. No personal data.
 * `test_carrier`: it goes with a carrier in test mode, which an order paid
 * in test mode may ship with.
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
  res.json({ ...orderState(order), test_carrier: await shipsWithTestCarrier(req.scope, order.id) })
}

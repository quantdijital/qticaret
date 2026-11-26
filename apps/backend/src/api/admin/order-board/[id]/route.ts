import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { LIFECYCLE_FIELDS, ORDER_STATE_FIELDS, orderState } from "../../../../lib/dashboard"
import type { StateOrder } from "../../../../lib/dashboard"
import { isBillingLocked } from "../../../../lib/invoicing/billing-lock"
import { birfaturaShips } from "../../../../lib/shipping/manager"
import { shipsWithTestCarrier } from "../../../../workflows/orders/test-shipping"

/**
 * One order's stage and what can be done next (adr/0022): the panel shows
 * these actions as they are, so it and the server agree. No personal data.
 * `test_carrier`: it goes with a carrier in test mode, which an order paid
 * in test mode may ship with. `billing_locked`: the invoice provider holds
 * the buyer, so the billing address stays (the same rule `POST
 * /admin/orders/:id` refuses a change by, lib/invoicing/billing-lock.ts).
 * `birfatura_ships`: BirFatura's cargo module makes the shop's labels
 * (adr/0072 Ek 2026-11-26); the order ships when its tracking comes back,
 * or by hand with a typed tracking.
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
  const [testCarrier, billingLocked, birfatura] = await Promise.all([
    shipsWithTestCarrier(req.scope, order.id),
    isBillingLocked(req.scope, order.id),
    birfaturaShips(req.scope),
  ])
  res.json({
    ...orderState(order),
    test_carrier: testCarrier,
    billing_locked: billingLocked,
    birfatura_ships: birfatura,
  })
}

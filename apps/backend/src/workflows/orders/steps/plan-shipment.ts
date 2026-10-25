import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { LIFECYCLE_FIELDS, ORDER_STATE_FIELDS, orderState } from "../../../lib/dashboard"
import type { ShipmentPlan, StateOrder } from "../../../lib/dashboard"
import { ValidationError } from "../../../lib/errors"

/**
 * What "ship" means for the order now (lib/dashboard/order-state): a
 * packed parcel handed over, or what is left packed into a new one. The
 * items come from the order, never from the request. Reads only.
 */
export const planShipmentStep = createStep(
  "orders-plan-shipment",
  async (input: { order_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: [...LIFECYCLE_FIELDS, ...ORDER_STATE_FIELDS],
      filters: { id: input.order_id },
    })
    const order = data[0] as StateOrder | undefined
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
    }
    const plan = orderState(order).ship
    if (!plan || plan.items.length === 0) {
      throw new ValidationError("orders.nothing_to_ship")
    }
    return new StepResponse<ShipmentPlan>(plan)
  }
)

import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { LIFECYCLE_FIELDS, ORDER_STATE_FIELDS, orderState } from "../../../lib/dashboard"
import type { ShipmentPlan, StateOrder } from "../../../lib/dashboard"
import { ValidationError } from "../../../lib/errors"
import { cancelRefundReference } from "../../../lib/orders/locks"
import { SHIPPING_PAYMENT_FIELDS, shippingBlock } from "../../../lib/payments/shippable"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../modules/order-refunds/service"

/**
 * What "ship" means for the order now (lib/dashboard/order-state): a
 * packed parcel handed over, or what is left packed into a new one. The
 * items come from the order; a request may name a part of what is left
 * (F7.10: an order in several parcels), never more. An order paid in a
 * provider's test mode, or whose payment is still awaited, is refused;
 * so is one whose cancel already gave the money back, should Medusa's
 * cancel have failed after it (security review 2026-10-28). Reads only.
 */
/** A part of what is left: each line once, at most what is left of it; a packed parcel goes whole. */
function partOf(plan: ShipmentPlan, wanted: { id: string; quantity: number }[]): ShipmentPlan {
  if (plan.fulfillment_id) {
    throw new ValidationError("orders.ship_packed_first", { field: "items" })
  }
  const left = new Map(plan.items.map((item) => [item.id, item.quantity]))
  const ids = new Set(wanted.map((item) => item.id))
  if (
    wanted.length === 0 ||
    ids.size !== wanted.length ||
    wanted.some((item) => item.quantity < 1 || item.quantity > (left.get(item.id) ?? 0))
  ) {
    throw new ValidationError("orders.ship_items_invalid", { field: "items" })
  }
  return { fulfillment_id: null, items: wanted }
}

export const planShipmentStep = createStep(
  "orders-plan-shipment",
  async (
    input: { order_id: string; items?: { id: string; quantity: number }[] | undefined },
    { container }
  ) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: [...LIFECYCLE_FIELDS, ...ORDER_STATE_FIELDS, ...SHIPPING_PAYMENT_FIELDS],
      filters: { id: input.order_id },
    })
    const order = data[0] as StateOrder | undefined
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
    }
    // adr/0027, adr/0029: no real money (test mode), or the money not in yet (a bank transfer)
    const blocked = shippingBlock(order as Parameters<typeof shippingBlock>[0])
    if (blocked) {
      throw new ValidationError(blocked)
    }
    const [cancelRefund] = await container
      .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
      .listOrderRefunds(
        { reference: cancelRefundReference(input.order_id), status: ["pending", "done"] },
        { take: 1, select: ["id"] }
      )
    if (cancelRefund) {
      throw new ValidationError("orders.ship_canceled_refund")
    }
    const plan = orderState(order).ship
    if (!plan || plan.items.length === 0) {
      throw new ValidationError("orders.nothing_to_ship")
    }
    return new StepResponse<ShipmentPlan>(input.items ? partOf(plan, input.items) : plan)
  }
)

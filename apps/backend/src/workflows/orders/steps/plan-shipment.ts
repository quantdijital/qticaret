import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { LIFECYCLE_FIELDS, ORDER_STATE_FIELDS, orderState } from "../../../lib/dashboard"
import type { ShipmentPlan, StateOrder } from "../../../lib/dashboard"
import { ValidationError } from "../../../lib/errors"
import { isCancelRefundReference } from "../../../lib/orders/locks"
import { SHIPPING_PAYMENT_FIELDS, shippingBlock } from "../../../lib/payments/shippable"
import { shipsWithTestCarrier } from "../test-shipping"
import { ORDER_REFUNDS_MODULE } from "../../../modules/order-refunds"
import type OrderRefundsModuleService from "../../../modules/order-refunds/service"
import { RETURN_REQUESTS_MODULE } from "../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../modules/return-requests/service"

type Lines = { id: string; quantity: number }[]

const sameLines = (a: Lines, b: Lines): boolean =>
  a.length === b.length &&
  a.every((line) => b.some((other) => other.id === line.id && other.quantity === line.quantity))

/**
 * The parcel a request names: a packed parcel's own lines hand it over
 * whole; other lines go in a new parcel, from what no parcel holds yet,
 * each line once and at most what is left of it. A packed parcel and the
 * rest go in either order (adr/0054, 2026-11-05 addendum: the order was a
 * bookkeeping habit, not a carrier's rule).
 */
function partOf(plan: ShipmentPlan, wanted: Lines): ShipmentPlan {
  if (plan.fulfillment_id && sameLines(wanted, plan.items)) {
    return plan
  }
  const open = plan.fulfillment_id ? plan.rest : plan.items
  const left = new Map(open.map((item) => [item.id, item.quantity]))
  const ids = new Set(wanted.map((item) => item.id))
  if (
    wanted.length === 0 ||
    ids.size !== wanted.length ||
    wanted.some((item) => item.quantity < 1 || item.quantity > (left.get(item.id) ?? 0))
  ) {
    throw new ValidationError("orders.ship_items_invalid", { field: "items" })
  }
  return { fulfillment_id: null, items: wanted, rest: [] }
}

/**
 * What "ship" means for the order now (lib/dashboard/order-state): a
 * packed parcel handed over, or what is left packed into a new one. The
 * items come from the order; a request may name a part of what is left
 * (F7.10: an order in several parcels), never more. An order paid in a
 * provider's test mode, or whose payment is still awaited, is refused;
 * so is one whose cancel already gave the money back, should Medusa's
 * cancel have failed after it (security review 2026-10-28), and one whose
 * exchange still waits for the parcel coming back (adr/0032 §6: the new
 * variant goes once the old one is in). Reads only.
 */
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
    // adr/0027, adr/0029: no real money (test mode), or the money not in yet (a bank transfer);
    // a test payment may still go with a carrier in test mode, where nothing leaves the shop
    const blocked = shippingBlock(order as Parameters<typeof shippingBlock>[0])
    if (
      blocked &&
      !(
        blocked === "orders.test_payment_not_shippable" &&
        (await shipsWithTestCarrier(container, input.order_id))
      )
    ) {
      throw new ValidationError(blocked)
    }
    const refunds = await container
      .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
      .listOrderRefunds(
        { order_id: input.order_id, status: ["pending", "done"] },
        { select: ["reference"] }
      )
    if (refunds.some((refund) => isCancelRefundReference(refund.reference))) {
      throw new ValidationError("orders.ship_canceled_refund")
    }
    const [awaited] = await container
      .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
      .listReturnRequests(
        { order_id: input.order_id, kind: "exchange", status: "approved" },
        { take: 1, select: ["id"] }
      )
    if (awaited) {
      throw new ValidationError("returns.exchange_awaiting_return")
    }
    const plan = orderState(order).ship
    if (!plan || plan.items.length === 0) {
      throw new ValidationError("orders.nothing_to_ship")
    }
    return new StepResponse<ShipmentPlan>(input.items ? partOf(plan, input.items) : plan)
  }
)

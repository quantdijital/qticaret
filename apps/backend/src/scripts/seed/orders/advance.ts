import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  cancelOrderWorkflow,
  capturePaymentWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"

/** Where a demo order is taken after checkout, as the shop would take it. */
export const DEMO_STAGES = ["to_ship", "shipped", "delivered", "canceled"] as const
export type DemoStage = (typeof DEMO_STAGES)[number]

interface OrderRow {
  items?: ({ id: string; quantity: number } | null)[] | null
  payment_collections?: ({ payments?: ({ id: string } | null)[] | null } | null)[] | null
}

async function orderParts(container: MedusaContainer, orderId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    // Medusa fills an item's quantity only with its detail (or the totals) requested
    fields: [
      "items.id",
      "items.quantity",
      "items.detail.quantity",
      "payment_collections.payments.id",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as OrderRow | undefined
  const items = (order?.items ?? []).flatMap((item) =>
    item ? [{ id: item.id, quantity: item.quantity }] : []
  )
  const payments = (order?.payment_collections ?? []).flatMap((collection) =>
    (collection?.payments ?? []).flatMap((payment) => (payment ? [payment.id] : []))
  )
  return { items, payments }
}

/**
 * Takes a placed order to `stage`: a canceled one is canceled before its
 * payment is taken (no refund, no credit line); the others have their
 * payment captured, then are packed, shipped and delivered as far as the
 * stage goes.
 */
export async function advanceOrder(
  container: MedusaContainer,
  orderId: string,
  stage: DemoStage
): Promise<void> {
  if (stage === "canceled") {
    await cancelOrderWorkflow(container).run({ input: { order_id: orderId } })
    return
  }
  const { items, payments } = await orderParts(container, orderId)
  for (const paymentId of payments) {
    await capturePaymentWorkflow(container).run({ input: { payment_id: paymentId } })
  }
  if (stage === "to_ship") {
    return
  }
  const { result: fulfillment } = await createOrderFulfillmentWorkflow(container).run({
    input: { order_id: orderId, items },
  })
  await createOrderShipmentWorkflow(container).run({
    input: { order_id: orderId, fulfillment_id: fulfillment.id, items },
  })
  if (stage === "delivered") {
    await markOrderFulfillmentAsDeliveredWorkflow(container).run({
      input: { orderId, fulfillmentId: fulfillment.id },
    })
  }
}

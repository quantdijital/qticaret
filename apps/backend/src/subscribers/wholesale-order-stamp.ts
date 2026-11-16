import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { alertPlacedOrder } from "../workflows/orders/placed-alert"
import { stampWholesaleOrder, wholesaleOrders } from "../workflows/wholesale/orders"

/**
 * A placed order is stamped wholesale when a wholesaler placed it
 * (ADR-0068 Ek 2026-11-15 (2)), then rings its one alert in the panel's
 * bell (`workflows/orders/placed-alert.ts`): one subscriber, so the alert
 * knows whether the order is wholesale (a retail order's "new order", a
 * wholesaler's own).
 *
 * Not a `completeCartWorkflow.orderCreated` hook: Medusa takes one
 * handler per hook and the loyalty plugin holds that one. `order.placed`
 * comes only for an order that was really placed (a rolled back checkout
 * sends none), the decision is taken as of the order's own time
 * (`wholesaleAt`), and a repeated event writes nothing twice. A stamp
 * that fails never touches the order: it is logged, and the order stays
 * on the retail list where staff still see it, with the retail alert. An
 * alert that fails is logged; the event coming again writes it, the stamp
 * already there.
 */
export default async function wholesaleOrderStamp({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  let accountId: string | null = null
  try {
    const stamp = await stampWholesaleOrder(container, data.id)
    // Stamped by an earlier run of this event: still the wholesaler's order
    accountId =
      stamp?.account_id ??
      (await wholesaleOrders(container, { order_ids: [data.id] })).get(data.id) ??
      null
  } catch (error) {
    logger.error({
      event: "wholesale.order_stamp_failed",
      order_id: data.id,
      err: errorSummary(error),
    })
  }
  try {
    await alertPlacedOrder(container, data.id, accountId)
  } catch (error) {
    logger.warn({
      event: "orders.placed_alert_failed",
      order_id: data.id,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }

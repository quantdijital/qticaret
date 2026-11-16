import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { alertWholesaleOrder } from "../workflows/wholesale/order-alert"
import { stampWholesaleOrder } from "../workflows/wholesale/orders"

/**
 * A wholesaler's order stamped wholesale (ADR-0068 Ek 2026-11-15 (2)) as
 * soon as it is placed. Not a `completeCartWorkflow.orderCreated` hook:
 * Medusa takes one handler per hook and the loyalty plugin holds that one.
 * `order.placed` comes only for an order that was really placed (a rolled
 * back checkout sends none), the decision is taken as of the order's own
 * time (`wholesaleAt`), and a repeated event writes nothing twice. A stamp
 * that fails never touches the order: it is logged, and the order stays
 * on the retail list where staff still see it. Once stamped, the order is
 * in the panel's bell for those who see wholesalers; a bell that fails is
 * logged, the stamp stays.
 */
export default async function wholesaleOrderStamp({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  let stamp: Awaited<ReturnType<typeof stampWholesaleOrder>>
  try {
    stamp = await stampWholesaleOrder(container, data.id)
  } catch (error) {
    logger.error({
      event: "wholesale.order_stamp_failed",
      order_id: data.id,
      err: errorSummary(error),
    })
    return
  }
  if (!stamp) {
    return
  }
  try {
    await alertWholesaleOrder(container, stamp)
  } catch (error) {
    logger.warn({
      event: "wholesale.order_alert_failed",
      order_id: data.id,
      err: errorSummary(error),
    })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }

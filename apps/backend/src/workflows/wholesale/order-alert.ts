import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { WHOLESALE_ORDER_TRIGGER } from "../../lib/notifications/feed"
import { notificationText } from "../../lib/notifications/messages"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A wholesaler's order in the panel's bell (ADR-0068): written once the
 * order is stamped wholesale, once per order. The bell had none: the
 * only order that wrote one was a bank transfer's (`staff-order-alerts`),
 * so an order paid any other way never reached it. The row keeps ids, the
 * number and the total; the wholesaler's name is read when the feed is
 * listed (`workflows/notifications/list.ts`), so a closed or erased
 * account is named as the order lists name it, never from a stale copy.
 */
export async function alertWholesaleOrder(
  container: Container,
  stamp: { order_id: string; account_id: string }
): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "total", "currency_code"],
    filters: { id: stamp.order_id },
  })
  const order = data[0] as
    | { id: string; display_id: number; total: MedusaAmount; currency_code?: string | null }
    | undefined
  if (!order) {
    return
  }
  const number = String(order.display_id)
  const total = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: (order.currency_code ?? "try").toUpperCase(),
  }).format(fromMedusaAmount(order.total, { allowRounding: true }) / 100)
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: "",
    channel: "feed",
    template: "admin-ui",
    trigger_type: WHOLESALE_ORDER_TRIGGER,
    resource_id: order.id,
    resource_type: "order",
    idempotency_key: `${WHOLESALE_ORDER_TRIGGER}:${order.id}`,
    data: {
      kind: "wholesale_order",
      order_id: order.id,
      account_id: stamp.account_id,
      number,
      total,
      ...notificationText(WHOLESALE_ORDER_TRIGGER, { number, total }),
    },
  })
}

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { notificationText } from "../../lib/notifications/messages"
import { shortLinesText, stockShortOf } from "../../lib/stock"
import { alertStaff } from "../messaging/staff"

/**
 * Tells the shop of a paid order placed short of stock (adr/0026 Ek
 * 2026-11-06): in the panel's bell, once per order, and by e-mail to the
 * staff list when order alerts are on. "Make or buy the units, or cancel
 * and refund."
 */
export async function alertStockShort(
  container: Pick<MedusaContainer, "resolve">,
  orderId: string
): Promise<boolean> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { id: orderId },
  })
  const order = data[0] as
    | { id: string; display_id: number | string; metadata?: Record<string, unknown> | null }
    | undefined
  const short = stockShortOf(order?.metadata)
  if (!order || !short) {
    return false
  }
  const number = String(order.display_id)
  await container.resolve(Modules.NOTIFICATION).createNotifications({
    to: "",
    channel: "feed",
    template: "admin-ui",
    trigger_type: "orders.stock_short",
    resource_id: order.id,
    resource_type: "order",
    idempotency_key: `orders.stock_short:${order.id}`,
    data: {
      kind: "stock_short",
      order_id: order.id,
      number,
      lines: short.lines.map(({ title, short: missing }) => ({ title, short: missing })),
      ...notificationText("orders.stock_short", { number, lines: shortLinesText(short) }),
    },
  })
  await alertStaff(container, { template: "staff.stock_short", resource_id: order.id })
  return true
}

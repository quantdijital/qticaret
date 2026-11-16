import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { notificationText } from "../../lib/notifications/messages"
import { formatLira } from "../../lib/payment-links/share"
import { linkNumber } from "../../lib/payment-links/snapshot"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What the panel's bell says about a link (adr/0051): paid, its prices
 * moved, a line short, or an order from it to look at (`needs_review`:
 * from a cart that was not the link's latest, from a link no longer open,
 * or after another order paid it; a second charge is possible).
 */
export type LinkAlert = "paid" | "prices_changed" | "out_of_stock" | "needs_review"

/**
 * One bell per link and kind (per link and order for `needs_review`): the
 * team's own feed, the number and total only. A bell that cannot be
 * written is logged; it never stops the customer's payment or the order.
 */
export async function alertLink(
  container: Container,
  kind: LinkAlert,
  link: { id: string; number: number; items_total: number; discount_total: number },
  orderId: string | null = null
): Promise<void> {
  const once = kind === "needs_review" && orderId ? `${link.id}:${orderId}` : link.id
  try {
    const number = linkNumber(link.number)
    const total = formatLira(link.items_total - link.discount_total)
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: `payment_links.${kind}`,
      resource_id: link.id,
      resource_type: "payment_link",
      idempotency_key: `payment_links.${kind}:${once}`,
      data: {
        kind: `payment_link_${kind}`,
        payment_link_id: link.id,
        number,
        ...(orderId ? { order_id: orderId } : {}),
        ...notificationText(`payment_links.${kind}`, { number, total }),
      },
    })
  } catch (error) {
    logger.warn({ event: "payment_links.alert_failed", kind, err: errorSummary(error) })
  }
}

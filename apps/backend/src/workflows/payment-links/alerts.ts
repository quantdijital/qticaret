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

/** The bell's idempotency key: per link and kind, per link and order for `needs_review`. */
export const alertKey = (kind: LinkAlert, linkId: string, orderId: string | null): string =>
  `payment_links.${kind}:${kind === "needs_review" && orderId ? `${linkId}:${orderId}` : linkId}`

/**
 * Whether the bell rang already (the notification module keeps its key):
 * what it reports is not logged again. False when it cannot be read.
 */
export async function alerted(
  container: Container,
  kind: LinkAlert,
  linkId: string,
  orderId: string | null
): Promise<boolean> {
  try {
    const notifications = container.resolve(Modules.NOTIFICATION) as unknown as {
      listNotifications: (
        filters: Record<string, unknown>,
        config: { select: string[]; take: number }
      ) => Promise<unknown[]>
    }
    const found = await notifications.listNotifications(
      { idempotency_key: alertKey(kind, linkId, orderId) },
      { select: ["id"], take: 1 }
    )
    return found.length > 0
  } catch {
    return false
  }
}

/**
 * One bell per link and kind (per link and order for `needs_review`): the
 * team's own feed, the number and total only. A link paid at the door
 * (`due: "on_delivery"`) rings its "paid" bell worded "ordered": the money
 * comes with the parcel. A bell that cannot be written is logged; it never
 * stops the customer's payment or the order.
 */
export async function alertLink(
  container: Container,
  kind: LinkAlert,
  link: { id: string; number: number; items_total: number; discount_total: number },
  orderId: string | null = null,
  due: "on_delivery" | null = null
): Promise<void> {
  const words = kind === "paid" && due ? "payment_links.paid_on_delivery" : `payment_links.${kind}`
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
      idempotency_key: alertKey(kind, link.id, orderId),
      data: {
        kind: `payment_link_${kind}`,
        payment_link_id: link.id,
        number,
        ...(orderId ? { order_id: orderId } : {}),
        ...(due ? { payment_due: due } : {}),
        ...notificationText(words, { number, total }),
      },
    })
  } catch (error) {
    logger.warn({ event: "payment_links.alert_failed", kind, err: errorSummary(error) })
  }
}

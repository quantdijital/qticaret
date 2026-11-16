import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { markPaymentLinkPaidWorkflow, missingMarks } from "./paid"

type Container = Pick<MedusaContainer, "resolve">

// Links looked at a run: a shop makes a few a day
const PAGE = 500
// How far back a paid link's order is checked, and an expired link's cart
const WINDOW_MS = 2 * 24 * 60 * 60 * 1000

interface CartRow {
  id: string
  completed_at?: Date | string | null
  order?: { id: string } | null
}

interface OrderRow {
  id: string
  metadata?: Record<string, unknown> | null
}

const service = (container: Container) =>
  container.resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)

/** The carts that became orders, by cart: the order's id (null when the cart shows none). */
export async function placedOrders(
  container: Container,
  cartIds: string[]
): Promise<Map<string, string | null>> {
  if (cartIds.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["id", "completed_at", "order.id"],
    filters: { id: cartIds },
  })
  return new Map(
    (data as CartRow[])
      .filter((cart) => Boolean(cart.completed_at ?? cart.order?.id))
      .map((cart) => [cart.id, cart.order?.id ?? null])
  )
}

async function markPaid(container: MedusaContainer, orderId: string): Promise<boolean> {
  const { result, errors } = await markPaymentLinkPaidWorkflow(container).run({
    input: { order_id: orderId },
    throwOnError: false,
  })
  if (errors[0]) {
    logger.warn({
      event: "payment_links.settle_failed",
      orderId,
      err: errorSummary(errors[0].error),
    })
    return false
  }
  return result.paid
}

/**
 * What the paid mark (`order.placed`, run once: the event bus does not
 * try a failed subscriber again) may have left undone, done on the hour
 * before links expire: a link whose cart became an order but is still
 * open (or expired since) is closed for that order; an order paid from a
 * link these two days that misses the link's keys gets them. The mark is
 * idempotent; the count is the links it changed.
 */
export async function settlePaymentLinks(
  container: MedusaContainer,
  now = new Date()
): Promise<number> {
  const links = service(container)
  const since = new Date(now.getTime() - WINDOW_MS)
  const rows = await links.listPaymentLinks(
    {
      $or: [
        { status: ["open", "draft"], cart_id: { $ne: null } },
        { status: "expired", cart_id: { $ne: null }, closed_at: { $gte: since } },
        { status: "paid", paid_at: { $gte: since } },
      ],
    },
    {
      select: ["id", "number", "status", "cart_id", "order_id", "created_by"],
      take: PAGE,
    }
  )
  const unpaid = rows.filter((link) => link.status !== "paid" && link.cart_id)
  const placed = await placedOrders(
    container,
    unpaid.flatMap((link) => (link.cart_id ? [link.cart_id] : []))
  )
  const due = new Set<string>()
  for (const link of unpaid) {
    const order = link.cart_id ? placed.get(link.cart_id) : undefined
    if (order) {
      due.add(order)
    }
  }
  const paid = rows.filter((link) => link.status === "paid" && link.order_id)
  if (paid.length > 0) {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: paid.flatMap((link) => (link.order_id ? [link.order_id] : [])) },
    })
    const orders = new Map((data as OrderRow[]).map((order) => [order.id, order.metadata]))
    for (const link of paid) {
      if (link.order_id && orders.has(link.order_id)) {
        const marks = missingMarks(orders.get(link.order_id), link)
        if (Object.keys(marks).length > 0) {
          due.add(link.order_id)
        }
      }
    }
  }
  let settled = 0
  for (const orderId of due) {
    if (await markPaid(container, orderId)) {
      settled += 1
    }
  }
  return settled
}

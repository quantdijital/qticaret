import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { PAYMENT_LINKS_MODULE } from "../../modules/payment-links"
import type PaymentLinksModuleService from "../../modules/payment-links/service"
import { completedLinkCarts } from "./link-carts"
import type { LinkCart } from "./link-carts"
import { markPaymentLinkPaidWorkflow, missingMarks } from "./paid"

// Carts looked at a page; a shop makes a few links a day
const PAGE = 500
// Pages looked at a run, newest cart ids first (an id dates the cart's making, not its
// completion); past them the run stops and says so: a shop makes a few links a day, so a run
// reaching it means something to look at
const MAX_PAGES = 20
// How far back a link's completed cart is looked at
const WINDOW_MS = 2 * 24 * 60 * 60 * 1000

interface OrderRow {
  id: string
  metadata?: Record<string, unknown> | null
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
 * before links expire. Every cart a link was bound to that became an order
 * these two days, its latest or one it gave up while that one was
 * completing: a link not yet paid is closed for that order; a link paid
 * by it whose order misses its keys gets them; a link another order paid
 * is a second charge staff are told of (`needs_review`, once). The mark is
 * idempotent; the count is the orders it settled. The carts come a page
 * at a time, up to `MAX_PAGES` a run (logged when reached).
 */
export async function settlePaymentLinks(
  container: MedusaContainer,
  now = new Date(),
  pageSize = PAGE
): Promise<number> {
  const since = new Date(now.getTime() - WINDOW_MS)
  let settled = 0
  let after: string | undefined
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const carts = await completedLinkCarts(
      container,
      after ? { since, after } : { since },
      pageSize
    )
    settled += await settlePage(container, carts)
    const last = carts[carts.length - 1]
    if (carts.length < pageSize || !last) {
      return settled
    }
    after = last.cart_id
  }
  logger.warn({ event: "payment_links.settle_ceiling", pages: MAX_PAGES, page_size: pageSize })
  return settled
}

/** One page of carts: the orders whose link is not settled for them, each marked. */
async function settlePage(container: MedusaContainer, carts: LinkCart[]): Promise<number> {
  const placed = carts.flatMap((cart) =>
    cart.order_id ? [{ ...cart, order_id: cart.order_id }] : []
  )
  if (placed.length === 0) {
    return 0
  }
  const links = await container
    .resolve<PaymentLinksModuleService>(PAYMENT_LINKS_MODULE)
    .listPaymentLinks(
      { id: [...new Set(placed.map((cart) => cart.link_id))] },
      { select: ["id", "number", "status", "order_id"], take: null }
    )
  const linkOf = new Map(links.map((link) => [link.id, link]))
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { id: placed.map((cart) => cart.order_id) },
  })
  const metadataOf = new Map((data as OrderRow[]).map((order) => [order.id, order.metadata]))
  const due = new Set<string>()
  for (const cart of placed) {
    const link = linkOf.get(cart.link_id)
    if (!link) {
      continue
    }
    const unsettled =
      link.status !== "paid" ||
      link.order_id !== cart.order_id ||
      Object.keys(missingMarks(metadataOf.get(cart.order_id), link)).length > 0
    if (unsettled) {
      due.add(cart.order_id)
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

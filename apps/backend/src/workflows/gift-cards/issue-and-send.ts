import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { sendMessageWorkflow } from "../messaging/send-message"
import { allGiftProducts, giftProductsAmong } from "./gift-products"
import { issueGiftCardsWorkflow } from "./issue-gift-cards"

type Container = MedusaContainer

const PAGE = 100
// How far back the hourly sweep looks for money taken: a day, and some
const SWEEP_HOURS = 26

async function productIdsOf(container: Container, orderIds: readonly string[]) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id", "items.product_id"],
    filters: { id: [...orderIds] },
  })
  return data as { id: string; items?: ({ product_id?: string | null } | null)[] | null }[]
}

/** The order a payment belongs to, or null. */
export async function orderOfPayment(container: Container, paymentId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "payment",
    fields: ["payment_collection.order.id"],
    filters: { id: paymentId },
  })
  const row = data[0] as
    { payment_collection?: { order?: { id?: string } | null } | null } | undefined
  return row?.payment_collection?.order?.id ?? null
}

/**
 * The recipient's e-mail for each line given (adr/0036 plumbing: the day's
 * quota, a duplicate never sent twice, a failure noted and tried again by
 * the sweep). A failed e-mail never undoes the cards. Nothing about the
 * recipient is logged.
 */
async function sendGiftMails(container: Container, orderId: string, lineIds: readonly string[]) {
  let sent = 0
  for (const lineId of lineIds) {
    try {
      const { result } = await sendMessageWorkflow(container).run({
        input: {
          template: "gift_card.issued",
          resource_id: orderId,
          key: lineId,
          extra: { line_id: lineId },
        },
      })
      sent += (result as { email?: string }).email === "sent" ? 1 : 0
    } catch (error) {
      logger.warn({ event: "gift_cards.mail_failed", orderId, err: errorSummary(error) })
    }
  }
  return sent
}

/**
 * Issues an order's gift cards once it is paid and mails each recipient
 * (adr/0025 Ek 2026-11-03). An order without gift lines costs one read. A
 * failed issue throws: the event's retry or the hourly sweep runs it again.
 */
export async function issueOrderGiftCards(container: Container, orderId: string) {
  const [row] = await productIdsOf(container, [orderId])
  const gifts = await giftProductsAmong(
    container,
    (row?.items ?? []).map((item) => item?.product_id)
  )
  if (gifts.size === 0) {
    return { state: "none", issued: 0, mailed: 0 }
  }
  const { result } = await issueGiftCardsWorkflow(container).run({
    input: { order_id: orderId },
  })
  if (result.issued > 0) {
    logger.info({ event: "gift_cards.issued", orderId, count: result.issued })
  }
  const mailed = await sendGiftMails(container, orderId, result.complete)
  return { state: result.state, issued: result.issued, mailed }
}

/**
 * The hourly sweep: every order money was taken for in the last day with
 * a gift line is issued again (nothing twice) and its e-mails sent again
 * (one already gone is not). It catches what a failed event left.
 */
export async function sweepGiftCards(container: Container, now: Date) {
  const gifts = await allGiftProducts(container)
  if (gifts.size === 0) {
    return { orders: 0, issued: 0, failed: 0 }
  }
  const payments = container.resolve(Modules.PAYMENT)
  const since = new Date(now.getTime() - SWEEP_HOURS * 3_600_000).toISOString()
  const paymentIds = new Set<string>()
  for (let skip = 0; ; skip += PAGE) {
    const captures = await payments.listCaptures(
      { created_at: { $gte: since } },
      { select: ["id", "payment_id"], take: PAGE, skip, order: { id: "ASC" } }
    )
    for (const capture of captures as { payment_id?: string | null }[]) {
      if (capture.payment_id) {
        paymentIds.add(capture.payment_id)
      }
    }
    if (captures.length < PAGE) {
      break
    }
  }
  const orderIds = new Set<string>()
  for (const paymentId of paymentIds) {
    const orderId = await orderOfPayment(container, paymentId)
    if (orderId) {
      orderIds.add(orderId)
    }
  }
  const ids = [...orderIds]
  const withGifts: string[] = []
  for (let start = 0; start < ids.length; start += PAGE) {
    for (const order of await productIdsOf(container, ids.slice(start, start + PAGE))) {
      if ((order.items ?? []).some((item) => item?.product_id && gifts.has(item.product_id))) {
        withGifts.push(order.id)
      }
    }
  }
  let issued = 0
  let failed = 0
  for (const orderId of withGifts) {
    try {
      issued += (await issueOrderGiftCards(container, orderId)).issued
    } catch (error) {
      failed += 1
      logger.error({ event: "gift_cards.issue_failed", orderId, err: errorSummary(error) })
    }
  }
  return { orders: withGifts.length, issued, failed }
}

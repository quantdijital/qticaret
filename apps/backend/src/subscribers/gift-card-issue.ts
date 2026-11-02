import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { errorSummary, logger } from "../lib/logging"
import { issueOrderGiftCards, orderOfPayment } from "../workflows/gift-cards/issue-and-send"

/**
 * A paid order's gift cards, issued and mailed to their recipients
 * (adr/0025 Ek 2026-11-03). A card payment is captured as it is
 * authorized, with no `payment.captured` of its own: its order's
 * `order.placed` finds it paid. A bank transfer or a payment taken at the
 * door is paid later: its capture's event. Both may come for one order;
 * issuing is idempotent under the order's lock. A failure is logged and
 * thrown for the event's retry; the hourly sweep (jobs/gift-card-issue.ts)
 * catches what is left.
 */
export default async function giftCardIssue({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = name === "order.placed" ? data.id : await orderOfPayment(container, data.id)
  if (!orderId) {
    return
  }
  try {
    await issueOrderGiftCards(container, orderId)
  } catch (error) {
    logger.error({ event: "gift_cards.issue_failed", orderId, err: errorSummary(error) })
    throw error
  }
}

export const config: SubscriberConfig = { event: ["order.placed", "payment.captured"] }

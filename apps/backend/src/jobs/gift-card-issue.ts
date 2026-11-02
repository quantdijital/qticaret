import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { sweepGiftCards } from "../workflows/gift-cards/issue-and-send"

/**
 * Sold gift cards an event left behind (adr/0025 Ek 2026-11-03): every
 * order money was taken for in the last day with a gift line, issued and
 * mailed again; nothing goes twice.
 */
export default async function giftCardIssue(container: MedusaContainer) {
  try {
    const swept = await sweepGiftCards(container, new Date())
    if (swept.issued > 0 || swept.failed > 0) {
      logger.info({ event: "gift_cards.swept", ...swept })
    }
  } catch (error) {
    logger.warn({ event: "gift_cards.sweep_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "gift-card-issue",
  schedule: "37 * * * *",
}

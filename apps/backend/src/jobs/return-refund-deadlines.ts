import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { alertRefundDeadlines } from "../workflows/returns/refund-deadline"

/**
 * Returns whose money is due soon (adr/0032 Ek 2026-11-03): staff are told
 * in the bell once the 10th of the law's 14 days to refund has passed
 * (MSY md. 12/1). Every hour; each request is told once.
 */
export default async function returnRefundDeadlines(container: MedusaContainer) {
  const told = await alertRefundDeadlines(container)
  if (told > 0) {
    logger.info({ event: "returns.refund_deadlines_alerted", told })
  }
}

export const config = {
  name: "return-refund-deadlines",
  schedule: "23 * * * *",
}

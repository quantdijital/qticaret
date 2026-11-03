import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { sweepPaymentLinks } from "../workflows/payment-links/retention"

/**
 * Payment links past their end closed with their code, and the personal
 * data of links closed thirty days ago removed (adr/0051 §12,
 * docs/kvkk-envanter.md). Every hour; the link page and the checkout check
 * the end themselves, so a late run opens nothing.
 */
export default async function paymentLinksExpiry(container: MedusaContainer) {
  const { expired, purged } = await sweepPaymentLinks(container)
  if (expired > 0 || purged > 0) {
    logger.info({ event: "payment_links.swept", expired, purged })
  }
}

export const config = {
  name: "payment-links-expiry",
  schedule: "17 * * * *",
}

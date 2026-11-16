import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { sweepPaymentLinks } from "../workflows/payment-links/retention"
import { settlePaymentLinks } from "../workflows/payment-links/settle"

/**
 * Payment links past their end closed with their code, and the personal
 * data of links closed thirty days ago removed (adr/0051 §12,
 * docs/kvkk-envanter.md). Every hour; the link page and the checkout check
 * the end themselves, so a late run opens nothing. First, what the paid
 * mark left undone (its event is not tried again): a link whose cart
 * became an order is paid, not expired.
 */
export default async function paymentLinksExpiry(container: MedusaContainer) {
  const settled = await settlePaymentLinks(container)
  const { expired, purged } = await sweepPaymentLinks(container)
  if (settled > 0 || expired > 0 || purged > 0) {
    logger.info({ event: "payment_links.swept", settled, expired, purged })
  }
}

export const config = {
  name: "payment-links-expiry",
  schedule: "17 * * * *",
}

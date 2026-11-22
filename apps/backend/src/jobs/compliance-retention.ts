import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import {
  forgetAbandonedCarts,
  forgetAuditClients,
  forgetOldContactMessages,
  forgetOldCookieConsents,
  forgetSettledStockAlerts,
  forgetSpentConsentRequests,
} from "../workflows/compliance/retention"
import {
  forgetAbandonedCartContacts,
  forgetGaClients,
  forgetSentMessages,
} from "../workflows/compliance/retention-contacts"
import { forgetTravelers } from "../workflows/booking/traveler-retention"

/**
 * The nightly retention pass (F13.5, adr/0041 §6): personal data whose
 * period ended, by docs/kvkk-envanter.md. Each part runs on its own; one
 * failing leaves the others done. A night's batch too small for a backlog
 * is finished the nights after.
 */
export default async function complianceRetention(container: MedusaContainer) {
  const now = new Date()
  const parts = {
    abandoned_carts: () => forgetAbandonedCarts(container, now),
    cookie_consents: () => forgetOldCookieConsents(container, now),
    audit_clients: () => forgetAuditClients(container, now),
    stock_alerts: () => forgetSettledStockAlerts(container, now),
    consent_requests: () => forgetSpentConsentRequests(container, now),
    contact_messages: () => forgetOldContactMessages(container, now),
    abandoned_cart_contacts: () => forgetAbandonedCartContacts(container, now),
    ga_clients: () => forgetGaClients(container, now),
    sent_messages: () => forgetSentMessages(container, now),
    // adr/0076 §7: travelers past their departure's period, and an abandoned cart's
    booking_travelers: () => forgetTravelers(container, now),
  }
  for (const [part, run] of Object.entries(parts)) {
    try {
      logger.info({ event: "compliance.retention", part, result: await run() })
    } catch (error) {
      logger.error({ event: "compliance.retention_failed", part, err: errorSummary(error) })
    }
  }
}

export const config = {
  name: "compliance-retention",
  schedule: "15 4 * * *",
}

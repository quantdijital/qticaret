import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import {
  forgetAbandonedCarts,
  forgetAuditClients,
  forgetOldCookieConsents,
  forgetSettledStockAlerts,
  forgetSpentConsentRequests,
} from "../workflows/compliance/retention"

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

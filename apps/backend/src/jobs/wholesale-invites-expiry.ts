import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { removeExpiredInvitations } from "../workflows/wholesale/accounts/remove"

/**
 * Wholesale invitations not taken up in 90 days removed, with the address
 * they held (ADR-0068 §10, decision 13). A resent one counts from its
 * resend.
 */
export default async function wholesaleInvitesExpiry(container: MedusaContainer) {
  try {
    const removed = await removeExpiredInvitations(container)
    if (removed > 0) {
      logger.info({ event: "wholesale.invites_expired", removed })
    }
  } catch (error) {
    logger.error({ event: "wholesale.invites_expiry_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "wholesale-invites-expiry",
  // 03:50 UTC, after the nightly price run
  schedule: "50 3 * * *",
}

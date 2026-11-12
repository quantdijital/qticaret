import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { planModeFor } from "../lib/plan-guard"
import { inviteStatus, sendInvites } from "../workflows/migration/invites"

/**
 * Each morning, the next share of the moved customers' invitations
 * (F14.5), while any wait. A bulk send: none while the shop is restricted
 * or suspended (adr/0061 Ek C19 L1, as `campaign-dispatch`); the waiting
 * ones go once it is open again.
 */
export default async function migrationInvites(container: MedusaContainer) {
  if ((await planModeFor(container)) !== "open") {
    return
  }
  if ((await inviteStatus(container)).waiting === 0) {
    return
  }
  const today = await sendInvites(container)
  logger.info({ event: "migration.invites_sent", ...today })
}

export const config = {
  name: "migration-invites",
  schedule: "0 9 * * *",
}

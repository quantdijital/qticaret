import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { inviteStatus, sendInvites } from "../workflows/migration/invites"

/** Each morning, the next share of the moved customers' invitations (F14.5), while any wait. */
export default async function migrationInvites(container: MedusaContainer) {
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

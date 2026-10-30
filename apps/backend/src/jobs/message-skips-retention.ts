import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { MESSAGING_MODULE } from "../modules/messaging"
import type MessagingModuleService from "../modules/messaging/service"

// Why a message did not go out matters while someone may ask about it
const KEEP_DAYS = 180

/** Messages not sent, noted for the panel's history (F12.8), go after KEEP_DAYS. */
export default async function messageSkipsRetention(container: MedusaContainer) {
  const removed = await container
    .resolve<MessagingModuleService>(MESSAGING_MODULE)
    .pruneSkips(new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000))
  if (removed > 0) {
    logger.info({ event: "messaging.skips_pruned", removed })
  }
}

export const config = {
  name: "message-skips-retention",
  schedule: "50 3 * * *",
}

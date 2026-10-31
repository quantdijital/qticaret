import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { FRAUD_GUARD_MODULE } from "../modules/fraud-guard"
import type FraudGuardModuleService from "../modules/fraud-guard/service"

/** Block list entries past their end go for good (F15.6, adr/0044 §4; an IP's a year at most). */
export default async function fraudRetention(container: MedusaContainer) {
  const removed = await container
    .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
    .pruneExpired()
  if (removed > 0) {
    logger.info({ event: "fraud.blocks_pruned", removed })
  }
}

export const config = {
  name: "fraud-retention",
  schedule: "50 3 * * *",
}

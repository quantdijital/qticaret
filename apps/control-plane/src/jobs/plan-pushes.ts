import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { deliverDuePushes } from "../lib/fleet/push"

/**
 * Plan document pushes that are due (adr/0061 §3.2, Ek C9): a push that
 * failed is tried again with backoff (1, 2, 4… minutes, at most an hour,
 * twelve tries), then left to the shop's pull. Counts only in the log.
 */
export default async function planPushesJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const { tried, delivered } = await deliverDuePushes(container)
    if (tried > 0) {
      logger.info(`cp.plan_pushes ${JSON.stringify({ tried, delivered })}`)
    }
  } catch (error) {
    logger.error(`cp.plan_pushes_failed ${JSON.stringify({ err: errorSummary(error) })}`)
  }
}

export const config = {
  name: "cp-plan-pushes",
  schedule: "* * * * *",
}

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { deliverDuePushes } from "../lib/fleet/push"

/** One run at a time (review L7): a run still pushing makes the next one skip. */
export const PLAN_PUSHES_LOCK = "cp-plan-pushes"

/**
 * Plan document pushes that are due (adr/0061 §3.2, Ek C9): a push that
 * failed is tried again with backoff (1, 2, 4… minutes, at most an hour,
 * twelve tries), then left to the shop's pull. Counts only in the log.
 */
export default async function planPushesJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let result: { tried: number; delivered: number }
  try {
    result = await container
      .resolve(Modules.LOCKING)
      .execute(PLAN_PUSHES_LOCK, () => deliverDuePushes(container), { timeout: 1 })
  } catch (error) {
    // Held by a run still going, or the pushes failed: the next minute tries again
    logger.warn(`cp.plan_pushes_skipped ${JSON.stringify({ err: errorSummary(error) })}`)
    return
  }
  if (result.tried > 0) {
    logger.info(`cp.plan_pushes ${JSON.stringify(result)}`)
  }
}

export const config = {
  name: "cp-plan-pushes",
  schedule: "* * * * *",
}

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { reconcilePlanDocuments } from "../lib/fleet/reissue"

/**
 * Every shop's plan document brought up to date (Ek C9), every ten
 * minutes: an exception that has expired changes what the shop may do
 * without anyone acting, and an issue that failed after a change is made
 * good here. A shop whose content did not change gets nothing new. One
 * run at a time (review L7).
 */
export default async function planReconcileJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const issued = await container
      .resolve(Modules.LOCKING)
      .execute("cp-plan-reconcile", () => reconcilePlanDocuments(container), { timeout: 1 })
    if (issued > 0) {
      logger.info(`cp.plan_reconciled ${JSON.stringify({ issued })}`)
    }
  } catch (error) {
    logger.error(`cp.plan_reconcile_failed ${JSON.stringify({ err: errorSummary(error) })}`)
  }
}

export const config = {
  name: "cp-plan-reconcile",
  schedule: "*/10 * * * *",
}

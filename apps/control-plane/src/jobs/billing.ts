import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { runBilling } from "../lib/billing/run"
import type { BillingRun } from "../lib/billing/run"

export const BILLING_LOCK = "cp-billing"

/**
 * Billing's day (adr/0061 §7, Ek C16), every hour: new periods' charges,
 * periods rolled, shops restricted past their grace, and from 09:00
 * Istanbul the day's reminders. Hourly rather than once at 09:00: the
 * schedule runs in the server's own time zone, and a server down at nine
 * still reminds that day; every part is idempotent and each reminder
 * goes once. One run at a time (the C9 jobs' lock).
 */
export default async function billingJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let run: BillingRun
  try {
    run = await container
      .resolve(Modules.LOCKING)
      .execute(BILLING_LOCK, () => runBilling(container, new Date()), { timeout: 1 })
  } catch (error) {
    logger.warn(`cp.billing_skipped ${JSON.stringify({ err: errorSummary(error) })}`)
    return
  }
  const { started, opened, restricted, released, failed, reminders } = run
  if (started + opened + restricted + released + failed > 0 || (reminders?.sent ?? 0) > 0) {
    logger.info(`cp.billing_run ${JSON.stringify(run)}`)
  }
}

export const config = {
  name: "cp-billing",
  schedule: "7 * * * *",
}

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { probeFleet } from "../lib/fleet/health-probe"
import type { ProbeRun } from "../lib/fleet/health-probe"

/** One run at a time (the C9 jobs' pattern): a run still probing makes the next one skip. */
export const HEALTH_PROBES_LOCK = "cp-health-probes"

/**
 * The shops' health (adr/0061 §5.4, Ek C13): every five minutes, each
 * running or provisioning shop's backend `/health` and, when known, its
 * storefront home page; three failures in a row make it unhealthy.
 * Counts only in the log.
 */
export default async function healthProbesJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let result: ProbeRun
  try {
    result = await container
      .resolve(Modules.LOCKING)
      .execute(HEALTH_PROBES_LOCK, () => probeFleet(container), { timeout: 1 })
  } catch (error) {
    logger.warn(`cp.health_probes_skipped ${JSON.stringify({ err: errorSummary(error) })}`)
    return
  }
  if (result.probed > 0) {
    logger.info(`cp.health_probes ${JSON.stringify(result)}`)
  }
}

export const config = {
  name: "cp-health-probes",
  schedule: "*/5 * * * *",
}

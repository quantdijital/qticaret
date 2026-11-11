import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { HEALTH_KEEP_MS, USAGE_KEEP_MS } from "../lib/fleet/health-rules"
import { fleetIn } from "../workflows/modules"

export const FLEET_RETENTION_LOCK = "cp-fleet-retention"

/** What the retention removes at `now`: usage older than 90 days, probes older than a day. */
export async function pruneFleetHistory(
  container: Pick<MedusaContainer, "resolve">,
  now: Date = new Date()
): Promise<{ usage: number; health: number }> {
  return await fleetIn(container).pruneMonitoring(
    new Date(now.getTime() - USAGE_KEEP_MS),
    new Date(now.getTime() - HEALTH_KEEP_MS)
  )
}

/**
 * The fleet's history kept bounded (Ek C13): hourly, usage snapshots past
 * 90 days and health probes past 24 hours are deleted for good. The
 * standings (`health_standing`) and plan documents stay. One run at a time.
 */
export default async function fleetRetentionJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const removed = await container
      .resolve(Modules.LOCKING)
      .execute(FLEET_RETENTION_LOCK, () => pruneFleetHistory(container), { timeout: 1 })
    if (removed.usage + removed.health > 0) {
      logger.info(`cp.fleet_retention ${JSON.stringify(removed)}`)
    }
  } catch (error) {
    logger.warn(`cp.fleet_retention_skipped ${JSON.stringify({ err: errorSummary(error) })}`)
  }
}

export const config = {
  name: "cp-fleet-retention",
  schedule: "41 * * * *",
}

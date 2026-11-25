import type { MedusaContainer } from "@medusajs/framework/types"
import { controlPlaneConfig } from "../lib/control-plane/config"
import { pullPlanDocument, warnIfStale } from "../lib/control-plane/pull"
import { errorSummary, logger } from "../lib/logging"

/** The pull's rhythm (adr/0061 §3.2): every 15 minutes, and once at boot. */
export const PULL_EVERY_MS = 15 * 60 * 1000

// This process's last pull; none yet after a boot, so the first run pulls.
// Not forgotten between a bundled test run's spec files (process-caches.ts):
// forgotten, the job pulled again after every file, at a minute's tick of
// its own, and its session stood in the way of the next file's snapshot
let lastPull: number | null = null

/** Whether a run at `now` pulls: the first after boot, then every 15 minutes. */
export function pullDue(last: number | null, now: number): boolean {
  return last === null || now - last >= PULL_EVERY_MS - 30_000
}

/**
 * The control plane's plan document, pulled (adr/0061 §3.2, Ek C9). The
 * job runs every minute so the first pull follows a boot within a minute;
 * after that it pulls every 15 minutes. Unmanaged, it does nothing. Then
 * a warning code if nothing valid has come for 24 hours. A failure never
 * changes the shop's status or document.
 */
export default async function controlPlanePullJob(container: MedusaContainer): Promise<void> {
  if (!controlPlaneConfig().managed) {
    return
  }
  const now = Date.now()
  if (!pullDue(lastPull, now)) {
    return
  }
  lastPull = now
  try {
    await pullPlanDocument(container)
    await warnIfStale(container)
  } catch (error) {
    logger.error({ event: "control_plane.pull_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "control-plane-pull",
  schedule: "* * * * *",
}

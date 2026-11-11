import type { MedusaContainer } from "@medusajs/framework/types"
import { controlPlaneConfig } from "../lib/control-plane/config"
import { sendUsageReport } from "../lib/control-plane/report"
import { errorSummary, logger } from "../lib/logging"

/** The report's rhythm (adr/0061 §5.4): every hour, and once shortly after boot. */
export const REPORT_EVERY_MS = 60 * 60 * 1000

// This process's last report; none yet after a boot, so the first run reports
let lastReport: number | null = null

/** Whether a run at `now` reports: the first after boot, then hourly (a minute's slack). */
export function reportDue(last: number | null, now: number): boolean {
  return last === null || now - last >= REPORT_EVERY_MS - 30_000
}

/**
 * The usage report to the control plane (adr/0061 §5.4, Ek C13). The job
 * runs every minute so the first report follows a boot within a minute
 * (the pull's pattern, Ek C9); after that it reports hourly. Unmanaged, it
 * does nothing. A failure is logged by code and changes nothing in the
 * shop; the next hour is the retry.
 */
export default async function controlPlaneUsageJob(container: MedusaContainer): Promise<void> {
  if (!controlPlaneConfig().managed) {
    return
  }
  const now = Date.now()
  if (!reportDue(lastReport, now)) {
    return
  }
  lastReport = now
  try {
    await sendUsageReport(container)
  } catch (error) {
    logger.error({ event: "control_plane.usage_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "control-plane-usage",
  schedule: "* * * * *",
}

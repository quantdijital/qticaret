import { isLocalEnv } from "@qticaret/server-kit"
import { logger } from "../logging"

export const DEFAULT_POLL_MINUTES = 30
const MAX_POLL_MINUTES = 30

export interface PollInterval {
  /** How often the tracking job runs, in minutes. */
  minutes: number
  /** The job's cron expression. */
  schedule: string
  /** A parcel is asked again only when last asked longer ago than this. */
  recheckMs: number
}

const intervalOf = (minutes: number): PollInterval => ({
  minutes,
  schedule: `*/${String(minutes)} * * * *`,
  // Five sixths of the interval: 25 minutes at 30, so a parcel asked one run
  // is due again the next, whatever the job's own lateness
  recheckMs: (minutes * 60 * 1000 * 5) / 6,
})

/**
 * How often parcels are asked about at their carrier. Live and on staging
 * always every 30 minutes; locally `SHIPMENT_POLL_MINUTES` (a whole number,
 * 1 to 30) shortens it so a parcel moved on a fake carrier's tracking page
 * shows up soon. `invalid` tells a value that was set but not understood.
 */
export function pollIntervalFrom(
  nodeEnv: string | undefined,
  raw: string | undefined
): PollInterval & { invalid: boolean } {
  const value = raw?.trim() ?? ""
  if (!isLocalEnv({ NODE_ENV: nodeEnv }) || value === "") {
    return { ...intervalOf(DEFAULT_POLL_MINUTES), invalid: false }
  }
  const minutes = /^\d+$/.test(value) ? Number(value) : Number.NaN
  if (!(minutes >= 1 && minutes <= MAX_POLL_MINUTES)) {
    return { ...intervalOf(DEFAULT_POLL_MINUTES), invalid: true }
  }
  return { ...intervalOf(minutes), invalid: false }
}

/** The interval this process runs with, read once when the job loads. */
export function shipmentPollInterval(env: NodeJS.ProcessEnv = process.env): PollInterval {
  const { invalid, ...interval } = pollIntervalFrom(env["NODE_ENV"], env["SHIPMENT_POLL_MINUTES"])
  if (invalid) {
    // The variable's name only: what it held is not logged
    logger.warn({
      event: "shipping.poll_interval_invalid",
      variable: "SHIPMENT_POLL_MINUTES",
      fallbackMinutes: DEFAULT_POLL_MINUTES,
    })
  }
  return interval
}

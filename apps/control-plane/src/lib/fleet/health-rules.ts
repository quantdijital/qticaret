import type { HealthState, HealthTarget } from "../../modules/fleet/models/health"

/**
 * The health rules (adr/0061 §5.4, Ek C13), pure:
 *
 * - a probe is `ok` only on a 200; any other status, a redirect (never
 *   followed), a timeout or no connection is a failure with a code
 * - `healthy` after an ok probe; `failing` after fewer failures in a row
 *   than `UNHEALTHY_AFTER`; `unhealthy` from there (three probes five
 *   minutes apart: about a quarter of an hour of no answer)
 * - a usage report is due hourly; past `REPORT_MISSING_AFTER_MS` (three
 *   missed hours) without one, the shop page warns "rapor gelmiyor"
 */

export const UNHEALTHY_AFTER = 3
/** One probe run at a time: the five-minute job and `cp:fleet probe` (review I1). */
export const HEALTH_PROBES_LOCK = "cp-health-probes"
export const PROBE_EVERY_MINUTES = 5
export const PROBE_TIMEOUT_MS = 5_000
/** Probes at once across the fleet: a slow shop holds one lane, not the run. */
export const PROBE_CONCURRENCY = 4
const HOUR_MS = 60 * 60 * 1000
export const REPORT_MISSING_AFTER_MS = 3 * HOUR_MS
/** History kept: probes a day, usage snapshots 90 days (the retention job). */
export const HEALTH_KEEP_MS = 24 * HOUR_MS
export const USAGE_KEEP_MS = 90 * 24 * HOUR_MS

/** A probe's outcome as stored: no body, no message, only a code. */
export interface ProbeResult {
  target: HealthTarget
  ok: boolean
  status_code: number | null
  latency_ms: number | null
  /** `health.http_<status>`, `health.redirect`, `health.timeout`, `health.unreachable`, `health.target_not_allowed` … */
  error: string | null
}

export interface HealthStanding {
  state: HealthState
  consecutive_failures: number
  last_ok_at: Date | null
  unhealthy_since: Date | null
}

/** The standing after a probe at `now`, from the one before (null: never probed). */
export function nextStanding(
  previous: HealthStanding | null,
  ok: boolean,
  now: Date,
  unhealthyAfter: number = UNHEALTHY_AFTER
): HealthStanding {
  if (ok) {
    return { state: "healthy", consecutive_failures: 0, last_ok_at: now, unhealthy_since: null }
  }
  const failures = (previous?.consecutive_failures ?? 0) + 1
  const unhealthy = failures >= unhealthyAfter
  return {
    state: unhealthy ? "unhealthy" : "failing",
    consecutive_failures: failures,
    last_ok_at: previous?.last_ok_at ?? null,
    unhealthy_since: unhealthy ? (previous?.unhealthy_since ?? now) : null,
  }
}

/** A status answered: what it means for a probe (redirects are never followed). */
export function statusOutcome(status: number): { ok: boolean; error: string | null } {
  if (status === 200) {
    return { ok: true, error: null }
  }
  if (status >= 300 && status < 400) {
    return { ok: false, error: "health.redirect" }
  }
  return { ok: false, error: `health.http_${String(status)}` }
}

/** Whether the shop's hourly report is overdue at `now` (never reported: only once it should have). */
export function reportMissing(
  lastReportAt: Date | null,
  now: Date,
  since: Date | null = null
): boolean {
  const from = lastReportAt ?? since
  return from !== null && now.getTime() - from.getTime() > REPORT_MISSING_AFTER_MS
}

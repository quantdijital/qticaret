import { logger } from "../../logging"

/**
 * Health of external dependencies for `GET /admin/integrations/health`
 * (docs/03 F2.6). Checks live apart from provider classes: providers are
 * isolated in their module containers, so each check builds what it needs
 * from the same environment config. Results carry a status and a reason
 * code only, never a secret or a raw error text.
 */

export type HealthStatus = "ok" | "down" | "not_configured"

export interface CheckOutcome {
  status: HealthStatus
  /** Short code such as `timeout` or `auth_failed`. */
  reason?: string
}

export interface IntegrationHealthCheck {
  id: string
  /** What sort of dependency: `cache`, `file_storage`, `payment`, ... */
  kind: string
  check: (signal: AbortSignal) => Promise<CheckOutcome>
}

export interface CheckResult extends CheckOutcome {
  id: string
  kind: string
  latency_ms: number
}

export interface HealthReport {
  /** `degraded` when any configured dependency is down. */
  status: "ok" | "degraded"
  checked_at: string
  checks: CheckResult[]
}

export interface HealthOptions {
  timeoutMs?: number
  /** How long a report is reused; the endpoint must not hammer providers. */
  ttlMs?: number
  now?: () => number
}

const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_TTL_MS = 30_000

async function runOne(
  check: IntegrationHealthCheck,
  timeoutMs: number,
  now: () => number
): Promise<CheckResult> {
  const started = now()
  const signal = AbortSignal.timeout(timeoutMs)
  let outcome: CheckOutcome
  try {
    // A check that ignores the signal still cannot hold the report
    outcome = await Promise.race([
      check.check(signal),
      new Promise<CheckOutcome>((resolve) => {
        signal.addEventListener(
          "abort",
          () => {
            resolve({ status: "down", reason: "timeout" })
          },
          { once: true }
        )
      }),
    ])
  } catch (error) {
    // The response gets a code only; the log keeps the error, redacted
    outcome = { status: "down", reason: signal.aborted ? "timeout" : "error" }
    logger.warn({ event: "integrations.health_check_error", check: check.id, err: error })
  }
  if (outcome.status === "down") {
    logger.warn({
      event: "integrations.health_check_failed",
      check: check.id,
      reason: outcome.reason,
    })
  }
  return {
    id: check.id,
    kind: check.kind,
    status: outcome.status,
    ...(outcome.reason === undefined ? {} : { reason: outcome.reason }),
    latency_ms: now() - started,
  }
}

/** Runs the checks in parallel, each within the timeout. */
export async function runHealthChecks(
  checks: readonly IntegrationHealthCheck[],
  options: HealthOptions = {}
): Promise<HealthReport> {
  const now = options.now ?? Date.now
  const results = await Promise.all(
    checks.map((check) => runOne(check, options.timeoutMs ?? DEFAULT_TIMEOUT_MS, now))
  )
  return {
    status: results.some((result) => result.status === "down") ? "degraded" : "ok",
    checked_at: new Date(now()).toISOString(),
    checks: results,
  }
}

/** A cached report: concurrent callers share one run, and a report is reused for the TTL. */
export function createHealthMonitor(
  checks: readonly IntegrationHealthCheck[],
  options: HealthOptions = {}
): { report: () => Promise<HealthReport> } {
  const now = options.now ?? Date.now
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  let cached: { at: number; report: Promise<HealthReport> } | null = null
  return {
    report: () => {
      if (cached === null || now() - cached.at >= ttlMs) {
        cached = { at: now(), report: runHealthChecks(checks, options) }
      }
      return cached.report
    },
  }
}

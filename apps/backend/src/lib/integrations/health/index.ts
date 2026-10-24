import { parseEnv } from "../../env"
import { createHealthMonitor } from "./health"
import type { IntegrationHealthCheck } from "./health"
import { redisHealthCheck } from "./redis-check"

export { createHealthMonitor, runHealthChecks } from "./health"
export type {
  CheckOutcome,
  CheckResult,
  HealthOptions,
  HealthReport,
  HealthStatus,
  IntegrationHealthCheck,
} from "./health"
export { redisHealthCheck } from "./redis-check"

/**
 * The checks the endpoint runs. New integrations add theirs here: the file
 * store in S13, payment, shipping and invoicing providers in their phases.
 */
export function defaultHealthChecks(): IntegrationHealthCheck[] {
  const env = parseEnv()
  return [redisHealthCheck(env.REDIS_URL)]
}

let monitor: ReturnType<typeof createHealthMonitor> | undefined

/** One monitor per process, so its cache spans requests. */
export function integrationHealth(): ReturnType<typeof createHealthMonitor> {
  monitor ??= createHealthMonitor(defaultHealthChecks())
  return monitor
}

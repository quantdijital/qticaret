import { parseEnv } from "../../env"
import type { AccountDetails } from "../account-check"
import { createHealthMonitor } from "./health"
import type { IntegrationHealthCheck } from "./health"
import { paytrHealthCheck } from "./paytr-check"
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
export { paytrHealthCheck } from "./paytr-check"
export { redisHealthCheck } from "./redis-check"

/** The shop's stored provider accounts (adr/0027), as the checks read them. */
export interface AccountSource {
  read: (provider: "paytr") => Promise<AccountDetails | null>
}

/**
 * The checks the endpoint runs. New integrations add theirs here: the file
 * store in S13, payment, shipping and invoicing providers in their phases.
 */
export function defaultHealthChecks(accounts: AccountSource): IntegrationHealthCheck[] {
  const env = parseEnv()
  return [redisHealthCheck(env.REDIS_URL), paytrHealthCheck(() => accounts.read("paytr"))]
}

let monitor: ReturnType<typeof createHealthMonitor> | undefined

/** One monitor per process, so its cache spans requests. */
export function integrationHealth(accounts: AccountSource): ReturnType<typeof createHealthMonitor> {
  monitor ??= createHealthMonitor(defaultHealthChecks(accounts))
  return monitor
}

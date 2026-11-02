import type { AccountDetails } from "../account-check"
import type { CredentialProviderName } from "../../../modules/integration-credentials/providers"
import { createHealthMonitor } from "./health"
import type { IntegrationHealthCheck } from "./health"
import { arasHealthCheck } from "./aras-check"
import { geliverHealthCheck } from "./geliver-check"
import { iyzicoHealthCheck } from "./iyzico-check"
import { paytrHealthCheck } from "./paytr-check"
import { netgsmHealthCheck } from "./netgsm-check"
import { yurticiHealthCheck } from "./yurtici-check"

export { createHealthMonitor, runHealthChecks } from "./health"
export type {
  CheckOutcome,
  CheckResult,
  HealthOptions,
  HealthReport,
  HealthStatus,
  IntegrationHealthCheck,
} from "./health"
export { arasHealthCheck } from "./aras-check"
export { geliverHealthCheck } from "./geliver-check"
export { iyzicoHealthCheck } from "./iyzico-check"
export { paytrHealthCheck } from "./paytr-check"
export { netgsmHealthCheck } from "./netgsm-check"
export { yurticiHealthCheck } from "./yurtici-check"

/** The shop's stored provider accounts (adr/0027), as the checks read them. */
export interface AccountSource {
  read: (provider: CredentialProviderName) => Promise<AccountDetails | null>
}

/**
 * The checks the endpoint runs: the shop's providers, as the Integrations
 * page shows them. New integrations add theirs here. The platform's own
 * services (Redis, the database) are operations' to watch, not the shop's.
 */
export function defaultHealthChecks(accounts: AccountSource): IntegrationHealthCheck[] {
  return [
    paytrHealthCheck(() => accounts.read("paytr")),
    iyzicoHealthCheck(() => accounts.read("iyzico")),
    geliverHealthCheck(() => accounts.read("geliver")),
    arasHealthCheck(() => accounts.read("aras")),
    yurticiHealthCheck(() => accounts.read("yurtici")),
    netgsmHealthCheck(() => accounts.read("netgsm")),
  ]
}

let monitor: ReturnType<typeof createHealthMonitor> | undefined

/** One monitor per process, so its cache spans requests. */
export function integrationHealth(accounts: AccountSource): ReturnType<typeof createHealthMonitor> {
  monitor ??= createHealthMonitor(defaultHealthChecks(accounts))
  return monitor
}

/** Drops the cached monitor (tests that change a provider's health between calls). */
export function forgetIntegrationHealth(): void {
  monitor = undefined
}

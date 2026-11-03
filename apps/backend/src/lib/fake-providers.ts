import type { Env } from "./env"
import { logger } from "./logging"
import type { StructuredLogger } from "./logging"

/**
 * The providers a fake server can stand in for, by the address that points
 * at it (development and tests only; the env schema refuses each once
 * deployed). With one set, the panel's own words about that provider (its
 * test mode: "turned off, shipments open on the real account") do not
 * hold on this machine: requests go to the fake whatever the panel says.
 */
export const FAKE_PROVIDER_ADDRESSES = {
  PAYTR_BASE_URL: "PayTR",
  IYZICO_BASE_URL: "iyzico",
  GELIVER_BASE_URL: "Geliver",
  ARAS_BASE_URL: "Aras",
  YURTICI_BASE_URL: "Yurtiçi",
  NETGSM_BASE_URL: "Netgsm",
  PARASUT_BASE_URL: "Paraşüt",
  SHOPIFY_BASE_URL: "Shopify",
  RESEND_BASE_URL: "Resend",
  APPLE_AUTH_BASE_URL: "Apple",
  GOOGLE_BASE_URL: "Google",
  META_GRAPH_BASE_URL: "Meta",
  GA4_BASE_URL: "GA4",
} as const satisfies Partial<Record<keyof Env, string>>

export type FakeAddressVariable = keyof typeof FAKE_PROVIDER_ADDRESSES

/** The providers this environment sends to a fake server, in the list's order. */
export function fakeProviders(
  env: Partial<Pick<Env, FakeAddressVariable>>
): { provider: string; variable: FakeAddressVariable }[] {
  return (Object.keys(FAKE_PROVIDER_ADDRESSES) as FakeAddressVariable[])
    .filter((variable) => env[variable] !== undefined)
    .map((variable) => ({ provider: FAKE_PROVIDER_ADDRESSES[variable], variable }))
}

// Once per process, however often the configuration is read
const warned = new Set<FakeAddressVariable>()

/**
 * One warning per provider sent to a fake server, at boot: names the
 * provider and its variable, never the address. Returns how many it wrote.
 */
export function warnFakeProviders(
  env: Partial<Pick<Env, FakeAddressVariable>>,
  log: Pick<StructuredLogger, "warn"> = logger
): number {
  let written = 0
  for (const { provider, variable } of fakeProviders(env)) {
    if (warned.has(variable)) {
      continue
    }
    warned.add(variable)
    log.warn(
      { event: "provider.fake_address", provider, variable },
      `${provider}: requests go to a fake server on this machine (${variable}); the panel's test mode does not change that`
    )
    written += 1
  }
  return written
}

/** Tests start with nothing warned. */
export const resetFakeProviderWarnings = (): void => {
  warned.clear()
}

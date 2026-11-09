import { isLocalEnv, isLoopbackUrl, parseEnv } from "../env"
import type { Env } from "../env"
import type { InvoicingProvider } from "../../modules/platform-settings/sections/invoicing"

/**
 * Whether the fake program may be picked or run: in tests only. An invoice
 * "issued" into a process's memory never reaches the tax office, and a
 * shop owner trying the panel locally must not be offered it. A shop that
 * picked it earlier issues nothing (treated as no program).
 */
export function fakeInvoicingAllowed(env: Pick<Env, "NODE_ENV"> = parseEnv()): boolean {
  return env.NODE_ENV === "test"
}

/**
 * Whether an order paid in a provider's test mode is invoiced all the
 * same: on a developer's machine (or in tests) whose Paraşüt is the fake
 * one on this machine (`PARASUT_BASE_URL` on a loopback address), so the
 * owner sees the whole invoice flow with test payments. Never deployed:
 * a test payment moved no money, and a live shop's invoice of it would
 * be a real tax document. Only `development` and `test` (`isLocalEnv`;
 * an unset NODE_ENV counts as live), whatever else is set.
 */
export function testPaymentsInvoiced(
  provider: InvoicingProvider,
  env: Pick<Env, "NODE_ENV" | "PARASUT_BASE_URL"> = parseEnv()
): boolean {
  if (!isLocalEnv(env)) {
    return false
  }
  return (
    provider === "parasut" &&
    env.PARASUT_BASE_URL !== undefined &&
    isLoopbackUrl(env.PARASUT_BASE_URL)
  )
}

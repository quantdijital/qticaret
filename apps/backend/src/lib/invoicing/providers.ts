import { parseEnv } from "../env"
import type { Env } from "../env"

/**
 * Whether the fake program may be picked or run: in tests only. An invoice
 * "issued" into a process's memory never reaches the tax office, and a
 * shop owner trying the panel locally must not be offered it. A shop that
 * picked it earlier issues nothing (treated as no program).
 */
export function fakeInvoicingAllowed(env: Pick<Env, "NODE_ENV"> = parseEnv()): boolean {
  return env.NODE_ENV === "test"
}

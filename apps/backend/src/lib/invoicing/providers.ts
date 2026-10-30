import { isLocalEnv, parseEnv } from "../env"

/**
 * Whether the fake program may be picked: in development and tests only.
 * An unset NODE_ENV counts as deployed: an invoice "issued" into a
 * process's memory would never reach the tax office.
 */
export function fakeInvoicingAllowed(): boolean {
  return isLocalEnv(parseEnv())
}

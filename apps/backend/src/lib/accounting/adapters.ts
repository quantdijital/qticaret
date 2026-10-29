import { isLocalEnv, parseEnv } from "../env"
import type { AccountingAdapter } from "./adapter"
import { fakeAccountingAdapter } from "./fake"

/** The programs a shop can pick (adr/0039 §5); `none` sends nothing. */
export const ACCOUNTING_ADAPTERS = ["none", "fake"] as const
export type AccountingAdapterId = (typeof ACCOUNTING_ADAPTERS)[number]

/**
 * Whether the fake program may be picked: in development and tests only.
 * An unset NODE_ENV counts as deployed: records marked sent into a
 * process's memory would never reach the books.
 */
export function fakeAccountingAllowed(): boolean {
  return isLocalEnv(parseEnv())
}

/** The adapter a setting names, or null when none is (or the fake one, deployed). */
export function accountingAdapterOf(id: AccountingAdapterId): AccountingAdapter | null {
  if (id === "fake") {
    return fakeAccountingAllowed() ? fakeAccountingAdapter : null
  }
  return null
}

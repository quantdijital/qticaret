import { parseEnv } from "../env"
import type { AccountingAdapter } from "./adapter"
import { fakeAccountingAdapter } from "./fake"

/** The programs a shop can pick (adr/0039 §5); `none` sends nothing. */
export const ACCOUNTING_ADAPTERS = ["none", "fake"] as const
export type AccountingAdapterId = (typeof ACCOUNTING_ADAPTERS)[number]

/** Whether the fake program may be picked: never where the shop runs live. */
export function fakeAccountingAllowed(): boolean {
  const env = parseEnv().NODE_ENV
  return env !== "production" && env !== "staging"
}

/** The adapter a setting names, or null when none is (or the fake one, deployed). */
export function accountingAdapterOf(id: AccountingAdapterId): AccountingAdapter | null {
  if (id === "fake") {
    return fakeAccountingAllowed() ? fakeAccountingAdapter : null
  }
  return null
}

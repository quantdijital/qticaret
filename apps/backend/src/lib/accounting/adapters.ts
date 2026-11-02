import { parseEnv } from "../env"
import type { Env } from "../env"
import type { AccountingAdapter } from "./adapter"
import { fakeAccountingAdapter } from "./fake"

/** The programs a shop can pick (adr/0039 §5); `none` sends nothing. */
export const ACCOUNTING_ADAPTERS = ["none", "fake"] as const
export type AccountingAdapterId = (typeof ACCOUNTING_ADAPTERS)[number]

/**
 * Whether the fake program may be picked: in tests only. Records marked
 * sent into a process's memory never reach the books, and a shop owner
 * trying the panel locally must not be offered a program that is not one.
 */
export function fakeAccountingAllowed(env: Pick<Env, "NODE_ENV"> = parseEnv()): boolean {
  return env.NODE_ENV === "test"
}

/** The adapter a setting names, or null when none is (or the fake one, outside tests). */
export function accountingAdapterOf(id: AccountingAdapterId): AccountingAdapter | null {
  if (id === "fake") {
    return fakeAccountingAllowed() ? fakeAccountingAdapter : null
  }
  return null
}

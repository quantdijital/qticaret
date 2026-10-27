import { createHmac, randomBytes } from "node:crypto"

/**
 * PayTR's signatures as dev.paytr.com writes them, kept apart from the
 * backend's own (`lib/payments/paytr/signatures.ts`) on purpose: the fake
 * server checks the client against the documentation, not against itself.
 */

export interface PaytrAccount {
  merchantId: string
  merchantKey: string
  merchantSalt: string
}

export const paytrSign = (account: PaytrAccount, parts: readonly string[]): string =>
  createHmac("sha256", account.merchantKey)
    .update(parts.join("") + account.merchantSalt)
    .digest("base64")

/** What PayTR posts to the shop's notification URL: `merchant_oid + salt + status + total_amount`. */
export function signNotification(
  account: PaytrAccount,
  fields: { merchant_oid: string; status: string; total_amount: string }
): string {
  return createHmac("sha256", account.merchantKey)
    .update(fields.merchant_oid + account.merchantSalt + fields.status + fields.total_amount)
    .digest("base64")
}

/**
 * A throwaway secret, fresh per run (docs/04: no fixed secret lives in the
 * repo, not even a fake one a scanner cannot tell apart from a real one).
 */
export const fakeSecret = (): string => randomBytes(9).toString("hex")

/** A PayTR account for one test run; the fake server checks signatures with it. */
export const fakePaytrAccount = (merchantId = "100001"): PaytrAccount => ({
  merchantId,
  merchantKey: fakeSecret(),
  merchantSalt: fakeSecret(),
})

/** Matches any of the values: for "no secret leaked" assertions. */
export const anyOf = (...values: readonly string[]): RegExp =>
  new RegExp(values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"))

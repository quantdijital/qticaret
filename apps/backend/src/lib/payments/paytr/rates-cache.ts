import { createSingleFlight } from "../../cache"
import { paytrApi } from "./client"
import type { PaytrCredentials, PaytrInstallmentRates } from "./types"
import { registerProcessCache } from "../../cache/process-caches"

// PayTR's rates change rarely; a product page must not ask PayTR on every view
const TTL_MS = 24 * 60 * 60 * 1000

let cached: { key: string; at: number; rates: PaytrInstallmentRates } | null = null
// Forgotten per spec file of a bundled test run
registerProcessCache(() => {
  cached = null
})
const once = createSingleFlight<PaytrInstallmentRates>()

/**
 * The shop's installment rates (F5 V6), asked of PayTR once a day per
 * process and per account: another shop number or mode asks again. A
 * failed ask serves yesterday's rates while there are any.
 */
export async function paytrInstallmentRates(
  account: PaytrCredentials,
  now: number = Date.now()
): Promise<PaytrInstallmentRates> {
  const key = `${account.merchantId}:${String(account.testMode)}`
  if (cached?.key === key && now - cached.at < TTL_MS) {
    return cached.rates
  }
  try {
    const rates = await once(key, () => paytrApi().installmentRates(account))
    cached = { key, at: now, rates }
    return rates
  } catch (error) {
    if (cached?.key === key) {
      return cached.rates
    }
    throw error
  }
}

/** Drops the kept rates (tests, or an account just changed in this process). */
export function forgetPaytrInstallmentRates(): void {
  cached = null
}

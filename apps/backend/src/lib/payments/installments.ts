import { kurus } from "../money"
import type { Kurus } from "../money"

/**
 * A card payment's installment table (F5 V6): per card family, the
 * installments offered with what each costs. A rate is the provider's
 * surcharge in percent on the whole amount; one payment has none. Amounts
 * in kuruş; the per-installment amount is for display (the provider
 * spreads the total).
 */

export interface InstallmentOption {
  count: number
  /** Percent added to the amount. */
  rate: number
  total: Kurus
  per_installment: Kurus
}

export interface InstallmentFamily {
  family: string
  options: InstallmentOption[]
}

/** The most installments offered: the shop's choice (0: the provider's), never past the provider's. */
export function installmentLimit(shopMax: number, providerMax: number | null): number {
  const provider = providerMax ?? 12
  return shopMax === 0 ? provider : Math.min(shopMax, provider)
}

export function installmentTable(
  amount: Kurus,
  rates: Readonly<Record<string, Readonly<Record<number, number>>>>,
  limit: number
): InstallmentFamily[] {
  return Object.entries(rates)
    .map(([family, byCount]) => ({
      family,
      options: [
        { count: 1, rate: 0, total: amount, per_installment: amount },
        ...Object.entries(byCount)
          .map(([count, rate]) => ({ count: Number(count), rate }))
          .filter(({ count }) => count >= 2 && count <= limit)
          .sort((a, b) => a.count - b.count)
          .map(({ count, rate }) => {
            const total = kurus(Math.round((amount * (100 + rate)) / 100))
            return { count, rate, total, per_installment: kurus(Math.round(total / count)) }
          }),
      ],
    }))
    .filter((family) => family.options.length > 1)
}

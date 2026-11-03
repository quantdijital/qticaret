import { CARD_FAMILIES } from "./cards"
import type { CardFamily } from "./cards"

/**
 * PayTR's installment rates (`oranlar`, dev.paytr.com taksit oranları):
 * card program → `taksit_N` → the surcharge in percent the shopper pays.
 */

export type InstallmentRates = Readonly<Record<string, Readonly<Record<string, string>>>>

/** The rates tests have priced against since F7: one table for World and Bonus, one for Axess. */
export const FAKE_INSTALLMENT_RATES: Readonly<Record<string, string>> = {
  taksit_2: "3.49",
  taksit_3: "4.69",
  taksit_6: "8.29",
  taksit_12: "15.9",
}

export const TEST_RATES: InstallmentRates = {
  world: FAKE_INSTALLMENT_RATES,
  bonus: FAKE_INSTALLMENT_RATES,
  axess: { taksit_2: "3.59" },
}

// 2 to 12 installments per program: a snapshot of what PayTR's panel shows a shop (2026-11)
const SNAPSHOT: Readonly<Record<CardFamily, readonly number[]>> = {
  axess: [4.32, 5.75, 7.2, 8.67, 10.16, 11.67, 13.2, 14.75, 16.32, 17.91, 19.52],
  bonus: [4.35, 5.79, 7.25, 8.73, 10.23, 11.75, 13.29, 14.85, 16.43, 18.03, 19.65],
  cardfinans: [4.41, 5.87, 7.35, 8.85, 10.37, 11.91, 13.47, 15.05, 16.65, 18.27, 19.91],
  maximum: [4.38, 5.83, 7.3, 8.79, 10.3, 11.83, 13.38, 14.95, 16.54, 18.15, 19.78],
  paraf: [4.26, 5.67, 7.1, 8.55, 10.02, 11.51, 13.02, 14.55, 16.1, 17.67, 19.26],
  world: [4.29, 5.71, 7.15, 8.61, 10.09, 11.59, 13.11, 14.65, 16.21, 17.79, 19.39],
  advantage: [4.44, 5.91, 7.4, 8.91, 10.44, 11.99, 13.56, 15.15, 16.76, 18.39, 20.04],
  combo: [4.23, 5.63, 7.05, 8.49, 9.95, 11.43, 12.93, 14.45, 15.99, 17.55, 19.13],
}

/** The eight programs' rates as PayTR answers them, for a developer's machine. */
export const RATE_SNAPSHOT: InstallmentRates = Object.fromEntries(
  CARD_FAMILIES.map((family) => [
    family,
    Object.fromEntries(
      SNAPSHOT[family].map((rate, index) => [`taksit_${String(index + 2)}`, String(rate)])
    ),
  ])
)

/** The counts a card can pay in: one payment always, the program's counts up to the shop's limit. */
export function allowedCounts(
  rates: InstallmentRates,
  family: CardFamily | null,
  maxInstallment: number
): number[] {
  const max = maxInstallment === 0 ? 12 : maxInstallment
  const table = family ? (rates[family] ?? {}) : {}
  const counts = Object.keys(table)
    .map((key) => Number(/^taksit_(\d{1,2})$/.exec(key)?.[1]))
    .filter((count) => Number.isInteger(count) && count > 1 && count <= max)
  return [1, ...counts.sort((a, b) => a - b)]
}

/** Kuruş charged for `count` installments on a card of the program. */
export function chargedAmount(
  rates: InstallmentRates,
  family: CardFamily | null,
  amount: number,
  count: number
): number {
  const rate = family && count > 1 ? Number(rates[family]?.[`taksit_${String(count)}`] ?? 0) : 0
  return Math.round(amount * (1 + rate / 100))
}

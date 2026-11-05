import { formatLira } from "@qticaret/ui"
import type { InstallmentFamilyView, InstallmentSummaryView } from "@qticaret/ui"
import { familyName } from "./content-extras"

/**
 * A price's installments in words (F5; owner 2026-11-05): the product
 * page's one line under the price and the table its dialog opens, both
 * from the same Store answer (`/store/payment/installments`), whose
 * amounts the backend worked out. Pure: the caller fetches.
 */

/** The Store answer's table: amounts as lira strings ("203.04"), a rate in percent. */
export interface InstallmentTable {
  enabled: boolean
  max_count: number
  families: {
    family: string
    options: { count: number; rate: number; total: string; per_installment: string }[]
  }[]
}

/** The families that offer two or more installments; none while the shop has them off. */
const offered = (table: InstallmentTable) =>
  table.enabled ? table.families.filter((family) => family.options.some((o) => o.count >= 2)) : []

/**
 * The table by card family, each written as on its cards, every amount in
 * the storefront's words; a count past one with no surcharge is "at the
 * price of one payment". Null: none to show.
 */
export function installmentFamilies(table: InstallmentTable): InstallmentFamilyView[] | null {
  const families = offered(table)
  if (families.length === 0) {
    return null
  }
  return families.map((family) => ({
    family: familyName(family.family),
    options: family.options.map((option) => ({
      count: option.count,
      perInstallment: formatLira(option.per_installment),
      total: formatLira(option.total),
      ...(option.count >= 2 && option.rate <= 0 ? { free: true } : {}),
    })),
  }))
}

/**
 * The most installments any card family offers for the price, and the
 * lowest monthly amount among the families at that count. Null under two.
 */
export function installmentSummary(table: InstallmentTable): InstallmentSummaryView | null {
  const options = offered(table).flatMap((family) => family.options)
  const count = Math.max(1, ...options.map((option) => option.count))
  const monthly = options
    .filter((option) => option.count === count)
    .map((option) => Number(option.per_installment))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
  if (count < 2 || monthly.length === 0) {
    return null
  }
  return { count, perInstallment: formatLira(Math.min(...monthly)) }
}

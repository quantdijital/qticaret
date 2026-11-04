/**
 * KDV rates (adr/0007): a country-level tax region for Türkiye whose
 * default rate applies to products without a VAT product type; every other
 * rate is bound to a product type of its own by a `product_type` rule.
 * Values here are data, not UI copy: the panel shows them as stored.
 */

export const TR_COUNTRY_CODE = "tr"
export const SYSTEM_TAX_PROVIDER_ID = "tp_system"

/** The rate a new shop starts with as its default. */
export const DEFAULT_VAT_RATE = { code: "KDV20", name: "KDV %20", rate: 20 } as const

/** The reduced rates a new shop starts with, each on a product type of its name. */
export const REDUCED_VAT_RATES = [
  { code: "KDV10", name: "KDV %10", rate: 10, productType: "KDV %10" },
  { code: "KDV1", name: "KDV %1", rate: 1, productType: "KDV %1" },
] as const

export type ReducedVatRate = (typeof REDUCED_VAT_RATES)[number]

/** Active rates a shop keeps at most: each is one product count on the settings screen. */
export const MAX_VAT_RATES = 20
export const VAT_NAME_MAX = 60
/** `KDV10`, `KDV8_5`: letters, digits, `_` and `-`, as the reports and invoices carry it. */
export const VAT_CODE = /^[A-Za-z0-9_-]{1,20}$/

/** A percentage in hundredths, the precision rates are kept and compared in. */
export const vatHundredths = (rate: number): number => Math.round(rate * 100)

/** Whether the percentage has at most two decimals (8,5 and 0,25, not 8,125). */
export const hasVatPrecision = (rate: number): boolean =>
  Number.isFinite(rate) && Math.abs(rate * 100 - Math.round(rate * 100)) < 1e-6

export const sameVatRate = (a: number, b: number): boolean => vatHundredths(a) === vatHundredths(b)

/** "10", "8,5": the percentage as a Turkish reader writes it. */
export const vatPercentText = (rate: number): string =>
  String(vatHundredths(rate) / 100).replace(".", ",")

/** "KDV %10", "KDV %8,5": the name a new rate gets when none is given. */
export const vatNameOf = (rate: number): string => `KDV %${vatPercentText(rate)}`

/** Names as people read them: the same words, case and Turkish letters aside. */
export const vatNameKey = (name: string): string =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr")

/** "KDV10", "KDV8_5"; `_2`, `_3`… after it while the code is taken (case aside). */
export function vatCodeOf(rate: number, taken: Iterable<string | null>): string {
  const used = new Set([...taken].flatMap((code) => (code ? [code.toUpperCase()] : [])))
  const base = `KDV${vatPercentText(rate).replace(",", "_")}`
  if (!used.has(base)) {
    return base
  }
  let n = 2
  while (used.has(`${base}_${String(n)}`)) {
    n += 1
  }
  return `${base}_${String(n)}`
}

import { hasVatPrecision, sameVatRate, vatNameKey } from "../tax"
import type { VatRate } from "../tax"

/**
 * The sheet's `KDV` cell (adr/0007): a product's rate by its name as the
 * KDV screen lists it ("KDV %10", case and Turkish letters aside), its code
 * ("KDV10") or its percentage ("10", "%10", "8,5"). Only the shop's active
 * rates; a percentage two rates share is the default's when one of them
 * is, else ambiguous. Pure.
 */

export type VatCell = { ok: true; rate: VatRate } | { ok: false; key: string }

// "10", "%10", "10 %", "8,5", "8.5"
const PERCENT = /^%?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%?$/

export function vatRateOf(cell: string, rates: readonly VatRate[]): VatCell {
  const active = rates.filter((rate) => rate.active)
  const key = vatNameKey(cell)
  const named = active.find(
    (rate) =>
      vatNameKey(rate.name) === key || rate.code?.toUpperCase() === cell.trim().toUpperCase()
  )
  if (named) {
    return { ok: true, rate: named }
  }
  const digits = PERCENT.exec(cell.trim())?.[1]
  const percent = digits === undefined ? Number.NaN : Number(digits.replace(",", "."))
  if (!hasVatPrecision(percent)) {
    return { ok: false, key: "catalog_import.vat_unknown" }
  }
  const same = active.filter((rate) => sameVatRate(rate.rate, percent))
  const [only] = same
  if (same.length === 1 && only) {
    return { ok: true, rate: only }
  }
  const byDefault = same.find((rate) => rate.is_default)
  if (byDefault) {
    return { ok: true, rate: byDefault }
  }
  return {
    ok: false,
    key: same.length > 1 ? "catalog_import.vat_ambiguous" : "catalog_import.vat_unknown",
  }
}

/**
 * The product type the product moves to for `rate` (adr/0007): undefined
 * when it is taxed at that rate already (a type bound to it, or the
 * default's for a product on no bound type, a new one included), so an
 * export uploaded again changes nothing; else the rate's own type, none
 * for a default bound to no type.
 */
export function vatTypeChange(
  rate: VatRate,
  rates: readonly VatRate[],
  currentTypeId: string | null
): string | null | undefined {
  const active = rates.filter((each) => each.active)
  const now =
    (currentTypeId ? active.find((each) => each.product_type_id === currentTypeId) : undefined) ??
    active.find((each) => each.is_default)
  return now?.id === rate.id ? undefined : rate.product_type_id
}

/**
 * Each product type's rate name, for the export: a type a rate is bound
 * to, its rate; any other product (no type, or one no rate is on) the
 * default's (`null` key).
 */
export function vatNamesByType(rates: readonly VatRate[]): {
  byType: ReadonlyMap<string, string>
  fallback: string | null
} {
  const active = rates.filter((rate) => rate.active)
  return {
    byType: new Map(
      active.flatMap((rate) => (rate.product_type_id ? [[rate.product_type_id, rate.name]] : []))
    ),
    fallback: active.find((rate) => rate.is_default)?.name ?? null,
  }
}

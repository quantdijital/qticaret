import type { VariantEdit } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { valuesOf } from "./variant-options"
import { levelAt, priceOf } from "./variant-values"
import type { Variant } from "./variant-values"

/** What a bulk change writes (the owner, 2026-11-25: "Tümüne fiyat uygula / stok uygula"). */
export const BULK_FIELDS = ["price", "cost", "stock"] as const
export type BulkField = (typeof BULK_FIELDS)[number]

const MAX_STOCK = 1_000_000
const MAX_COST = 10_000_000

/** "Renk=Kırmızı": a filter by one option's value; empty is every variant. */
export const filterKey = (title: string, value: string) => `${title}=${value}`

/** The variants a filter keeps, in the list's order. */
export function filtered(
  product: ProductDetail,
  variants: readonly Variant[],
  filter: string
): Variant[] {
  if (filter === "") {
    return [...variants]
  }
  return variants.filter((variant) =>
    Object.entries(valuesOf(product, variant)).some(
      ([title, value]) => filterKey(title, value) === filter
    )
  )
}

/** The typed value as the field takes it; null when it is not one. */
export function bulkValue(field: BulkField, text: string): number | null {
  if (field === "stock") {
    const trimmed = text.trim()
    return /^\d+$/.test(trimmed) && Number(trimmed) <= MAX_STOCK ? Number(trimmed) : null
  }
  const amount = parseMoneyInput(text)
  if (amount === null) {
    return null
  }
  return field === "price"
    ? amount > 0
      ? amount
      : null
    : amount >= 0 && amount <= MAX_COST
      ? amount
      : null
}

/**
 * One variant's edit for a bulk change; null when there is nothing to
 * write (the price is already that, or its stock is not counted). The
 * amount is the shop's own typed price: the server checks it, nothing is
 * computed here.
 */
export function bulkEdit(
  variant: Variant,
  field: BulkField,
  value: number,
  locationId: string | null
): VariantEdit | null {
  const base: VariantEdit = {
    variantId: variant.id,
    prices: (variant.prices ?? []).map(({ id, currency_code, amount }) => ({
      id,
      currency_code,
      amount,
    })),
    amount: null,
    stock: null,
    backorder: null,
  }
  if (field === "price") {
    return priceOf(variant) === value ? null : { ...base, amount: value }
  }
  if (field === "cost") {
    return { ...base, cost: value }
  }
  const level = levelAt(variant, locationId)
  if (!variant.manage_inventory || !level.inventoryItemId || locationId === null) {
    return null
  }
  return {
    ...base,
    stock: { inventoryItemId: level.inventoryItemId, quantity: value, hasLevel: level.hasLevel },
  }
}

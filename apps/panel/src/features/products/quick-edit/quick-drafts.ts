import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import type { VariantEdit } from "@/features/products/api/product-edit"
import { DIGITS } from "@/features/inventory/drafts"

/**
 * The product list's quick edit (WooCommerce's "Quick Edit", owner
 * 2026-11-26): price, stock and status typed in the list's cells and kept
 * here until "N değişikliği kaydet". A draft keeps the row it was typed
 * on, so changes survive another page, search or filter. Only a product
 * of one variant takes a price or stock here; one of several shows its
 * range and links to its page. Stock that is not tracked is not edited:
 * such a product always sells. Pure, so it is tested on its own.
 */

const CURRENCY = "try"
// The product form's bound for a count (variant-values.ts)
const MAX_STOCK = 1_000_000

export type QuickStatus = "published" | "draft"

/** What the quick edit reads of a listed product. */
export interface QuickProduct {
  id: string
  title: string
  status: string
  variants?:
    | ({
        id: string
        manage_inventory?: boolean | null
        prices?: ({ id: string; amount: number; currency_code: string } | null)[] | null
        inventory_items?:
          | ({
              inventory_item_id: string
              inventory?: {
                location_levels?:
                  ({ location_id: string; stocked_quantity?: number | null } | null)[] | null
              } | null
            } | null)[]
          | null
      } | null)[]
    | null
}

/** A product's typed values; absent ones are as stored. */
export interface QuickDraft {
  product: QuickProduct
  price?: string
  stock?: string
  status?: QuickStatus
}

export type QuickDrafts = Record<string, QuickDraft>

/** The product's one variant, or null for a product of several (or none). */
export function soleVariant(product: QuickProduct) {
  const variants = product.variants ?? []
  return variants.length === 1 ? (variants[0] ?? null) : null
}

/** The shelf the quick edit writes: the item and its count at the shop's default location. */
export function shelfOf(product: QuickProduct, locationId: string | null) {
  const variant = soleVariant(product)
  const link = variant?.inventory_items?.[0]
  if (!variant?.manage_inventory || !link || !locationId) {
    return null
  }
  const level = (link.inventory?.location_levels ?? []).find(
    (row) => row?.location_id === locationId
  )
  return {
    inventoryItemId: link.inventory_item_id,
    quantity: level?.stocked_quantity ?? 0,
    hasLevel: Boolean(level),
  }
}

/** The stored values as the cells show them. */
export function storedValues(product: QuickProduct, locationId: string | null) {
  const variant = soleVariant(product)
  const price = (variant?.prices ?? []).find((row) => row?.currency_code === CURRENCY)
  const shelf = shelfOf(product, locationId)
  return {
    price: price ? formatMoneyInput(price.amount) : "",
    stock: shelf ? String(shelf.quantity) : "",
    status: product.status,
  }
}

const samePrice = (typed: string, stored: string) =>
  typed.trim() === stored || (parseMoneyInput(typed) ?? NaN) === parseMoneyInput(stored)

/** The fields of a draft that differ from what is stored. */
export function changedFields(
  draft: QuickDraft,
  locationId: string | null
): ("price" | "stock" | "status")[] {
  const stored = storedValues(draft.product, locationId)
  const fields: ("price" | "stock" | "status")[] = []
  if (draft.price !== undefined && !samePrice(draft.price, stored.price)) {
    fields.push("price")
  }
  if (draft.stock !== undefined && draft.stock.trim() !== stored.stock) {
    fields.push("stock")
  }
  if (draft.status !== undefined && draft.status !== stored.status) {
    fields.push("status")
  }
  return fields
}

/** How many values differ across the drafts: the "N değişikliği kaydet" count. */
export const changeCount = (drafts: QuickDrafts, locationId: string | null): number =>
  Object.values(drafts).reduce((sum, draft) => sum + changedFields(draft, locationId).length, 0)

export const isPrice = (text: string): boolean => (parseMoneyInput(text) ?? 0) > 0

export const isStock = (text: string): boolean =>
  DIGITS.test(text.trim()) && Number(text) <= MAX_STOCK

/** Whether a typed value can be saved; untouched ones always can. */
export function draftProblems(draft: QuickDraft, locationId: string | null) {
  const fields = changedFields(draft, locationId)
  return {
    price: fields.includes("price") && !isPrice(draft.price ?? ""),
    stock: fields.includes("stock") && !isStock(draft.stock ?? ""),
  }
}

export const hasProblems = (drafts: QuickDrafts, locationId: string | null): boolean =>
  Object.values(drafts).some((draft) => {
    const problems = draftProblems(draft, locationId)
    return problems.price || problems.stock
  })

/** What saving one product sends: its status, and its variant's price and stock. */
export function saveOf(
  draft: QuickDraft,
  locationId: string | null
): { status: QuickStatus | null; variant: VariantEdit | null } {
  const fields = changedFields(draft, locationId)
  const variant = soleVariant(draft.product)
  const shelf = shelfOf(draft.product, locationId)
  const price = fields.includes("price") ? parseMoneyInput(draft.price ?? "") : null
  const stock =
    fields.includes("stock") && shelf ? { ...shelf, quantity: Number(draft.stock) } : null
  return {
    status: fields.includes("status") ? (draft.status ?? null) : null,
    variant:
      variant && (price !== null || stock)
        ? {
            variantId: variant.id,
            prices: (variant.prices ?? []).flatMap((row) => (row ? [row] : [])),
            amount: price,
            stock,
            backorder: null,
          }
        : null,
  }
}

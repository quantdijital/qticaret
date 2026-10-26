import type { LevelQuantity } from "../../stock/write-levels"
import { baseTryOf, nextPrices, pricesOf } from "../prices"
import { MAX_AMOUNT, MAX_QUANTITY } from "./change"
import type { BulkChange } from "./change"
import { altWrites } from "./plan-alt"
import type { BulkProduct } from "./products"

/**
 * What one change does to one product (F3.10), read from what it has: the
 * writes, nothing (it is so already), or why it is left out. Pure; the
 * run writes the plans, one product at a time.
 */

export type BulkWrite =
  | { action: "price"; variants: { id: string; prices: ReturnType<typeof nextPrices> }[] }
  | { action: "stock"; create: LevelQuantity[]; update: LevelQuantity[] }
  | { action: "status"; status: "published" | "draft" }
  | {
      action: "category"
      /** The product's categories after the change; undefined when they stay. */
      category_ids?: string[]
      /** The primary category after the change; undefined when it stays. */
      primary_category_id?: string | null
    }
  | { action: "seo_template"; values: { seo_title?: null; seo_description?: null } }
  | { action: "alt_text"; alts: { id: string; alt: string }[] }

export type BulkPlan =
  | { kind: "write"; write: BulkWrite }
  | { kind: "unchanged" }
  /** Left out, with the server message key that says why. */
  | { kind: "skipped"; key: string }

export interface PlanContext {
  /** The shop's default warehouse, where stock changes. */
  locationId: string | null
}

const UNCHANGED: BulkPlan = { kind: "unchanged" }
const skipped = (key: string): BulkPlan => ({ kind: "skipped", key })
const writing = (write: BulkWrite): BulkPlan => ({ kind: "write", write })

/** To the kuruş, half away from zero, as a person would round a price. */
export const roundAmount = (value: number): number =>
  Math.sign(value) * (Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100)

function nextAmount(current: number | undefined, change: Extract<BulkChange, { action: "price" }>) {
  if (change.mode === "set") {
    return roundAmount(change.value)
  }
  if (current === undefined) {
    return undefined
  }
  return roundAmount(
    change.mode === "percent" ? current * (1 + change.value / 100) : current + change.value
  )
}

// The base TRY price of every variant; one with none takes a price only when set
function planPrice(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "price" }>
): BulkPlan {
  const variants = product.variants ?? []
  const writes: { id: string; prices: ReturnType<typeof nextPrices> }[] = []
  let unpriced = 0
  for (const variant of variants) {
    const prices = pricesOf(variant.prices)
    const base = baseTryOf(prices)
    const amount = nextAmount(base?.amount, change)
    if (amount === undefined) {
      unpriced += 1
      continue
    }
    // A product is changed whole or not at all: one price out of range leaves it as it is
    if (amount <= 0 || amount > MAX_AMOUNT) {
      return skipped("bulk_edit.price_out_of_range")
    }
    if (base?.amount !== amount) {
      writes.push({ id: variant.id, prices: nextPrices(prices, amount) })
    }
  }
  if (writes.length > 0) {
    return writing({ action: "price", variants: writes })
  }
  return variants.length > 0 && unpriced === variants.length
    ? skipped("bulk_edit.no_price")
    : UNCHANGED
}

// Quantities at the default warehouse, for variants whose stock is kept
function planStock(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "stock" }>,
  locationId: string
): BulkPlan {
  const variants = product.variants ?? []
  const create: LevelQuantity[] = []
  const update: LevelQuantity[] = []
  let untracked = 0
  for (const variant of variants) {
    const item = variant.inventory_items?.[0]
    if (!variant.manage_inventory || !item) {
      untracked += 1
      continue
    }
    const level = item.inventory?.location_levels?.find((each) => each.location_id === locationId)
    const current = level ? Number(level.stocked_quantity) : 0
    const next = change.mode === "set" ? change.value : current + change.value
    if (next < 0) {
      return skipped("bulk_edit.stock_negative")
    }
    if (next > MAX_QUANTITY) {
      return skipped("bulk_edit.stock_out_of_range")
    }
    if (next === current) {
      continue
    }
    const quantity = { inventory_item_id: item.inventory_item_id, location_id: locationId }
    ;(level ? update : create).push({ ...quantity, stocked_quantity: next })
  }
  if (create.length + update.length > 0) {
    return writing({ action: "stock", create, update })
  }
  return variants.length > 0 && untracked === variants.length
    ? skipped("bulk_edit.stock_untracked")
    : UNCHANGED
}

function planCategory(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "category" }>
): BulkPlan {
  const ids = (product.categories ?? []).flatMap((category) => (category ? [category.id] : []))
  const primary = product.product_extension?.primary_category_id ?? null
  const target = change.category_id
  const has = ids.includes(target)
  if (change.mode === "add") {
    return has ? UNCHANGED : writing({ action: "category", category_ids: [...ids, target] })
  }
  if (change.mode === "remove") {
    if (!has) {
      return UNCHANGED
    }
    const category_ids = ids.filter((id) => id !== target)
    // The primary category goes with it (readers fall back to the deepest one left)
    const write =
      primary === target ? { category_ids, primary_category_id: null } : { category_ids }
    return writing({ action: "category", ...write })
  }
  if (has && primary === target) {
    return UNCHANGED
  }
  const added = has ? {} : { category_ids: [...ids, target] }
  return writing({ action: "category", ...added, primary_category_id: target })
}

// The page's own SEO text given up for the shop's template (as the advisor's one-click fix)
function planSeoTemplate(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "seo_template" }>
): BulkPlan {
  const values = Object.fromEntries(
    change.fields.filter((field) => product.seo_meta?.[field]?.trim()).map((field) => [field, null])
  )
  return Object.keys(values).length > 0 ? writing({ action: "seo_template", values }) : UNCHANGED
}

export function planBulkChange(
  product: BulkProduct,
  change: BulkChange,
  context: PlanContext
): BulkPlan {
  switch (change.action) {
    case "price":
      return planPrice(product, change)
    case "stock":
      return context.locationId
        ? planStock(product, change, context.locationId)
        : skipped("bulk_edit.no_location")
    case "status":
      return product.status === change.status
        ? UNCHANGED
        : writing({ action: "status", status: change.status })
    case "category":
      return planCategory(product, change)
    case "seo_template":
      return planSeoTemplate(product, change)
    case "alt_text":
      return altWrites(product)
  }
}

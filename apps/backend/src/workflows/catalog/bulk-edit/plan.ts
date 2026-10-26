import { deepestCategory } from "../../../lib/catalog"
import {
  BPS_PER_WHOLE,
  addKurus,
  fromMedusaAmount,
  multiplyByRateBps,
  toMedusaAmount,
} from "../../../lib/money"
import type { Kurus } from "../../../lib/money"
import { baseTryOf, nextPrices, pricesOf } from "../prices"
import { MAX_AMOUNT } from "./change"
import type { BulkChange } from "./change"
import { altWrites } from "./plan-alt"
import { UNCHANGED, skipped, writing } from "./plan-result"
import type { BulkDiff, BulkPlan, PlanContext } from "./plan-result"
import { planStock } from "./plan-stock"
import type { BulkProduct } from "./products"

/**
 * What one change does to one product (F3.10), read from what it has just
 * before it is written (plan-result.ts). Pure.
 */

export type { BulkDiff, BulkPlan, BulkWrite, PlanContext } from "./plan-result"

// Kuruş, never floats (adr/0010): a percent is basis points, rounded half up
const PERCENT_BPS = 100

/** The base TRY price after the change, in kuruş; none when there is nothing to change by. */
export function nextKurus(
  current: number | undefined,
  change: Extract<BulkChange, { action: "price" }>
): Kurus | undefined {
  if (change.mode === "set") {
    return fromMedusaAmount(change.value, { allowRounding: true })
  }
  if (current === undefined) {
    return undefined
  }
  const now = fromMedusaAmount(current, { allowRounding: true })
  return change.mode === "percent"
    ? multiplyByRateBps(now, BPS_PER_WHOLE + Math.round(change.value * PERCENT_BPS))
    : addKurus(now, fromMedusaAmount(change.value, { allowRounding: true }))
}

const lira = (amount: Kurus): number => Number(toMedusaAmount(amount))

// The base TRY price of every variant; one with none takes a price only when set
function planPrice(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "price" }>
): BulkPlan {
  const variants = product.variants ?? []
  const writes: { id: string; prices: ReturnType<typeof nextPrices> }[] = []
  const diff: BulkDiff = {}
  let unpriced = 0
  for (const variant of variants) {
    const prices = pricesOf(variant.prices)
    const base = baseTryOf(prices)
    const next = nextKurus(base?.amount, change)
    if (next === undefined) {
      unpriced += 1
      continue
    }
    // A product is changed whole or not at all: one price out of range leaves it as it is
    if (next <= 0 || next > MAX_AMOUNT * 100) {
      return skipped("bulk_edit.price_out_of_range")
    }
    const amount = lira(next)
    if (base === undefined || fromMedusaAmount(base.amount, { allowRounding: true }) !== next) {
      writes.push({ id: variant.id, prices: nextPrices(prices, amount) })
      diff[`variant:${variant.id}:price:try`] = { before: base?.amount ?? null, after: amount }
    }
  }
  if (writes.length > 0) {
    return writing({ action: "price", variants: writes }, diff)
  }
  return variants.length > 0 && unpriced === variants.length
    ? skipped("bulk_edit.no_price")
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
  const categories = (after: string[]) => ({ category_ids: { before: ids, after } })
  const primaryTo = (after: string | null) => ({ primary_category_id: { before: primary, after } })
  if (change.mode === "add") {
    const after = [...ids, target]
    return has ? UNCHANGED : writing({ action: "category", category_ids: after }, categories(after))
  }
  if (change.mode === "remove") {
    if (!has) {
      return UNCHANGED
    }
    const after = ids.filter((id) => id !== target)
    if (primary !== target) {
      return writing({ action: "category", category_ids: after }, categories(after))
    }
    // The primary category goes with it: the deepest one left takes its place
    const next =
      deepestCategory((product.categories ?? []).filter((row) => row?.id !== target))?.id ?? null
    return writing(
      { action: "category", category_ids: after, primary_category_id: next },
      { ...categories(after), ...primaryTo(next) }
    )
  }
  if (has && primary === target) {
    return UNCHANGED
  }
  const after = [...ids, target]
  return has
    ? writing({ action: "category", primary_category_id: target }, primaryTo(target))
    : writing(
        { action: "category", category_ids: after, primary_category_id: target },
        { ...categories(after), ...primaryTo(target) }
      )
}

// The page's own SEO text given up for the shop's template (as the advisor's one-click fix)
function planSeoTemplate(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "seo_template" }>
): BulkPlan {
  const fields = change.fields.filter((field) => product.seo_meta?.[field]?.trim())
  if (fields.length === 0) {
    return UNCHANGED
  }
  return writing(
    { action: "seo_template", values: Object.fromEntries(fields.map((field) => [field, null])) },
    Object.fromEntries(
      fields.map((field) => [field, { before: product.seo_meta?.[field] ?? null, after: null }])
    )
  )
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
        : writing(
            { action: "status", status: change.status },
            { status: { before: product.status, after: change.status } }
          )
    case "category":
      return planCategory(product, change)
    case "seo_template":
      return planSeoTemplate(product, change)
    case "alt_text":
      return altWrites(product)
  }
}

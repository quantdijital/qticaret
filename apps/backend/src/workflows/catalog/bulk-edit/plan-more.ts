import { MedusaError } from "@medusajs/framework/utils"
import { fromMedusaAmount, subtractKurus, toMedusaAmount } from "../../../lib/money"
import { planVariantSales, shownSale } from "../../pricing/variant-sale/plan"
import type { SaleEntry, VariantSaleInput, VariantSalePlan } from "../../pricing/variant-sale/plan"
import type { BulkChange } from "./change"
import { UNCHANGED, skipped, writing } from "./plan-result"
import type { BulkDiff, BulkPlan, PlanContext } from "./plan-result"
import type { BulkProduct } from "./products"

/**
 * The brand, a tag, selling past stock and the sale price for one product
 * (WooCommerce's bulk edit fields), planned from what it has just before
 * it is written. Pure.
 */

const fold = (text: string) => text.trim().toLocaleLowerCase("tr")

export function planBrand(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "brand" }>
): BulkPlan {
  const current = product.brand?.id ?? null
  return current === change.brand_id
    ? UNCHANGED
    : writing(
        { action: "brand", brand_id: change.brand_id },
        { brand_id: { before: current, after: change.brand_id } }
      )
}

/** A tag added or taken off; the tag is matched by id, or by name while it is still to be made. */
export function planTag(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "tag" }>,
  context: PlanContext
): BulkPlan {
  const tags = (product.tags ?? []).flatMap((tag) => (tag ? [tag] : []))
  const target = context.tag ?? { id: null, value: change.value }
  const has = tags.some((tag) =>
    target.id ? tag.id === target.id : fold(tag.value) === fold(target.value)
  )
  const before = tags.map((tag) => tag.value)
  if (change.mode === "add") {
    if (has) {
      return UNCHANGED
    }
    return writing(
      // A tag still to be made has no id in a preview; the run makes it before planning
      { action: "tag", tag_ids: [...tags.map((tag) => tag.id), ...(target.id ? [target.id] : [])] },
      { tags: { before, after: [...before, target.value] } }
    )
  }
  if (!has) {
    return UNCHANGED
  }
  const kept = tags.filter((tag) => tag.id !== target.id)
  return writing(
    { action: "tag", tag_ids: kept.map((tag) => tag.id) },
    { tags: { before, after: kept.map((tag) => tag.value) } }
  )
}

/**
 * Selling past stock on or off for the variants whose stock is tracked; a
 * variant whose stock is not tracked always sells, so it is left as it is.
 */
export function planBackorder(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "backorder" }>
): BulkPlan {
  const variants = product.variants ?? []
  const tracked = variants.filter((variant) => variant.manage_inventory === true)
  if (variants.length > 0 && tracked.length === 0) {
    return skipped("bulk_edit.stock_untracked")
  }
  const writes = tracked.filter((variant) => (variant.allow_backorder === true) !== change.allow)
  if (writes.length === 0) {
    return UNCHANGED
  }
  const diff: BulkDiff = Object.fromEntries(
    writes.map((variant) => [
      `variant:${variant.id}:allow_backorder`,
      { before: variant.allow_backorder === true, after: change.allow },
    ])
  )
  return writing(
    {
      action: "backorder",
      variants: writes.map((variant) => ({ id: variant.id, allow_backorder: change.allow })),
    },
    diff
  )
}

// What the sale asks of each variant with a regular price; a reason key when one cannot take it
function saleInput(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "sale" }>
): VariantSaleInput | string | null {
  const facts = product.sale
  if (!facts) {
    return "bulk_edit.product_missing"
  }
  if (change.mode === "clear") {
    const clear = facts.variants
      .filter((variant) => (facts.existing.get(variant.id) ?? []).length > 0)
      .map((variant) => variant.id)
    return clear.length === 0 ? null : { product_id: product.id, set: [], clear }
  }
  const priced = facts.variants.flatMap((variant) =>
    variant.base === null ? [] : [{ id: variant.id, base: variant.base }]
  )
  if (priced.length === 0) {
    return "bulk_edit.no_price"
  }
  const days = { starts_at: change.starts_at, ends_at: change.ends_at }
  const set: SaleEntry[] = []
  for (const variant of priced) {
    if (change.mode === "percent") {
      set.push({
        variant_id: variant.id,
        amount: null,
        rate_bps: Math.round((change.value ?? 0) * 100),
        ...days,
      })
      continue
    }
    const off = fromMedusaAmount(change.value ?? 0, { allowRounding: true })
    if (off >= variant.base) {
      return "bulk_edit.sale_out_of_range"
    }
    set.push({ variant_id: variant.id, amount: subtractKurus(variant.base, off), ...days })
  }
  return { product_id: product.id, set, clear: [] }
}

/**
 * Each variant's sale price (adr/0086): a share or an amount off its own
 * regular price, or its sales cleared, checked by the product page's own
 * rules (below the regular price, days in order and not over). A product
 * any of whose variants cannot take it is left whole.
 */
export function planSale(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "sale" }>,
  context: PlanContext
): BulkPlan {
  const input = saleInput(product, change)
  if (input === null) {
    return UNCHANGED
  }
  if (typeof input === "string") {
    return skipped(input)
  }
  const facts = product.sale
  if (!facts) {
    return skipped("bulk_edit.product_missing")
  }
  const now = context.now ?? new Date()
  let plan: VariantSalePlan
  try {
    plan = planVariantSales(input, {
      currency: "",
      product_title: facts.title,
      variants: facts.variants,
      existing: facts.existing,
      now,
    })
  } catch (error) {
    return skipped(error instanceof MedusaError ? error.message : "bulk_edit.sale_refused")
  }
  if (plan.create.length === 0 && plan.remove.length === 0) {
    return UNCHANGED
  }
  const after = new Map(
    plan.create.map((list) => [list.metadata.variant_id, list.prices[0]?.amount ?? null])
  )
  const diff: BulkDiff = {}
  for (const variant of facts.variants) {
    const named =
      input.clear.includes(variant.id) || input.set.some((each) => each.variant_id === variant.id)
    if (!named || plan.unchanged.includes(variant.id)) {
      continue
    }
    const before = shownSale(facts.existing.get(variant.id) ?? [], now)
    diff[`variant:${variant.id}:sale`] = {
      before: before ? Number(toMedusaAmount(before.amount)) : null,
      after: after.get(variant.id) ?? null,
    }
  }
  return writing({ action: "sale", set: input.set, clear: input.clear }, diff)
}

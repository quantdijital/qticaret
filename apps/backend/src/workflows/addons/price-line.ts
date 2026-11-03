import {
  addonUnitPrice,
  chooseAddons,
  isStalePrice,
  lineAddonProblem,
  lineAddons,
  lineAddonsOf,
  maxQuantityOf,
  selectionsOf,
} from "../../lib/catalog/addons"
import type {
  AddonSelection,
  LineAddons,
  SelectionProblem,
  StoredAddon,
} from "../../lib/catalog/addons"
import { toMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import type { MedusaContainer } from "@medusajs/framework/types"
import { linesOf, productAddonsAmong, quantityOf, variantPrice } from "./cart"
import type { AddonCart, AddonCartLine } from "./cart"

type Container = Pick<MedusaContainer, "resolve">

/** A line with its add-ons priced now: what its unit price and record should be. */
export interface PricedLine {
  line_id: string
  quantity: number
  unit_price: Kurus
  /** The add-ons on the price before a sale; null without a sale. */
  compare_at_unit_price: Kurus | null
  addons: LineAddons
}

const lira = (amount: Kurus): number => Number(toMedusaAmount(amount))

/**
 * Prices a line's picks against the product's add-ons and the variant's
 * price in the cart now (adr/0052 §1); the problem when they cannot be
 * sold. No picks is no add-on line: null.
 */
export async function priceAddonLine(
  container: Container,
  cart: AddonCart,
  line: AddonCartLine,
  addons: readonly StoredAddon[],
  selections: readonly AddonSelection[]
): Promise<{ priced: PricedLine | null } | { problem: SelectionProblem }> {
  const result = chooseAddons(addons, selections)
  if ("problem" in result) {
    return result
  }
  if (result.chosen.length === 0) {
    return { priced: null }
  }
  const quantity = quantityOf(line)
  const problem = lineAddonProblem(addons, result.chosen, quantity)
  if (problem) {
    return { problem }
  }
  const base = line.variant_id
    ? await variantPrice(container, cart, line.variant_id, quantity)
    : null
  if (!base) {
    return { problem: { key: "addons.unavailable", field: "line_id" } }
  }
  return {
    priced: {
      line_id: line.id,
      quantity,
      unit_price: addonUnitPrice(base.calculated, result.chosen),
      compare_at_unit_price:
        base.original === null ? null : addonUnitPrice(base.original, result.chosen),
      addons: lineAddons(
        result.chosen,
        lira(base.calculated),
        maxQuantityOf(addons, result.chosen)
      ),
    },
  }
}

/** What a cart's add-on lines need before it is paid for. */
export interface AddonReview {
  /** Lines carrying add-ons. */
  lines: number
  /** Why the cart cannot be paid for as it is, or null. */
  problem: SelectionProblem | null
  /** Lines whose unit price is not what their add-ons cost now. */
  stale: PricedLine[]
}

// Picks that no longer price (an add-on or choice gone, its rules changed) read as unavailable
const KEPT_PROBLEMS = new Set(["addons.max_quantity", "addons.required"])

/**
 * The cart's add-on lines priced again from the product's add-ons and the
 * variant's price now (adr/0052 §5): Medusa never reprices a custom-priced
 * line, so a price list that ended, a customer who signed in or a changed
 * add-on price leaves it stale. A line of a product with a required
 * add-on that carries none cannot be sold either.
 */
export async function reviewAddonLines(
  container: Container,
  cart: AddonCart
): Promise<AddonReview> {
  const lines = linesOf(cart)
  const products = await productAddonsAmong(
    container,
    lines.map((line) => line.product_id)
  )
  const review: AddonReview = { lines: 0, problem: null, stale: [] }
  for (const line of lines) {
    const addons = line.product_id ? (products.get(line.product_id) ?? []) : []
    const recorded = lineAddonsOf(line.metadata)
    if (!recorded) {
      if (addons.some((addon) => addon.required)) {
        review.problem ??= { key: "addons.required", field: "items" }
      }
      continue
    }
    review.lines += 1
    const result = await priceAddonLine(container, cart, line, addons, selectionsOf(recorded))
    if ("problem" in result || !result.priced) {
      const key = "problem" in result ? result.problem.key : "addons.unavailable"
      review.problem ??= {
        key: KEPT_PROBLEMS.has(key) ? key : "addons.unavailable",
        field: "items",
      }
      continue
    }
    if (isStalePrice(line, result.priced.unit_price)) {
      review.stale.push(result.priced)
    }
  }
  return review
}

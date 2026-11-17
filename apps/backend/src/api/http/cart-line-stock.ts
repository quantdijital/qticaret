import type { MedusaRequest } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ValidationError } from "../../lib/errors"
import { isInsufficientInventory } from "../../lib/stock/refusals"
import { lineAvailableUnits } from "../../workflows/stock/line-stock"
import type { LineAsk } from "../../workflows/stock/line-stock"
import { routePathKeepingCase } from "./request-path"

/** A line's add or quantity change asked for more units than are for sale. */
export const INSUFFICIENT_STOCK = "cart.insufficient_stock"

/**
 * The most units the answer names (`values.available`). A small count is
 * what a shopper needs to fix the quantity and what a shop's own "few
 * left" already hints at; a larger one says no more than the sentence.
 */
export const SHOWN_UNITS_MAX = 10

// The core routes a shopper adds a line or changes its quantity by
// (Medusa 2.21.2: addToCartWorkflow, updateLineItemInCartWorkflow); ours
// that write lines keep their quantity or are the shop's own (payment links)
const LINE_ROUTE = /^\/store\/carts\/(cart_[0-9A-Za-z]+)\/line-items(?:\/(cali_[0-9A-Za-z]+))?$/
const VARIANT_ID = /^variant_[0-9A-Za-z]+$/

/**
 * The line asked for when `error` is Medusa's refusal of more units than
 * are for sale on a store line route; null for anything else, which the
 * error handler answers as before.
 */
export function cartLineAskOf(error: unknown, req: MedusaRequest): LineAsk | null {
  if (req.method !== "POST" || !isInsufficientInventory(error)) {
    return null
  }
  const match = LINE_ROUTE.exec(routePathKeepingCase(req))
  if (!match?.[1]) {
    return null
  }
  const lineId = match[2] ?? null
  const fields = (req as { validatedBody?: unknown }).validatedBody ?? req.body
  const variant = (fields as { variant_id?: unknown } | null | undefined)?.variant_id
  const variantId = typeof variant === "string" && VARIANT_ID.test(variant) ? variant : null
  return { cartId: match[1], lineId, variantId: lineId ? null : variantId }
}

/**
 * The refusal as the shopper hears it: `cart.insufficient_stock`, with the
 * units for sale when they are few (1 to `SHOWN_UNITS_MAX`). A count that
 * cannot be read leaves the sentence without one; it never fails.
 */
export async function insufficientStockError(
  container: Pick<MedusaContainer, "resolve">,
  ask: LineAsk
): Promise<ValidationError> {
  const units = await lineAvailableUnits(container, ask).catch(() => null)
  const shown = units !== null && units >= 1 && units <= SHOWN_UNITS_MAX
  return new ValidationError(INSUFFICIENT_STOCK, {
    field: "quantity",
    ...(shown ? { values: { available: String(units) } } : {}),
  })
}

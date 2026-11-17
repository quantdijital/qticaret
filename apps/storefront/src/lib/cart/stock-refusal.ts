import type { Translate } from "@qticaret/ui"
import { isStoreApiError } from "../store-api/errors"

/**
 * A line's add or quantity change asked for more units than are for sale
 * (backend `cart.insufficient_stock`): "Bu üründen stokta istediğiniz kadar yok."
 */
export const INSUFFICIENT_STOCK = "cart.insufficient_stock"

/** The same with the units for sale: "Bu üründen stokta yalnız {count} adet var." */
export const INSUFFICIENT_STOCK_COUNT = "cart.insufficient_stock_count"

/** The cart page's address parameter carrying the units for sale with `?hata=cart.insufficient_stock`. */
export const STOCK_COUNT_PARAM = "adet"

// The backend names a few units only (1 to 10); a cart line holds at most 99
const UNITS = /^[1-9][0-9]?$/

/** A count as the backend or the address gives it: a whole number 1 to 99, or null. */
export const unitsOf = (value: unknown): number | null =>
  typeof value === "string" && UNITS.test(value) ? Number(value) : null

export const isInsufficientStock = (error: unknown): boolean =>
  isStoreApiError(error) && error.messageKey === INSUFFICIENT_STOCK

/** The units for sale the backend named with the refusal (`values.available`), or null. */
export function availableUnitsOf(error: unknown): number | null {
  if (!isStoreApiError(error) || error.messageKey !== INSUFFICIENT_STOCK) {
    return null
  }
  const body = error.body as { values?: { available?: unknown } } | null
  return unitsOf(body?.values?.available)
}

/**
 * Where a refused quantity change goes back to: the cart with the key and,
 * when the backend named it, the count; only a checked whole number goes
 * in the address, never the backend's text.
 */
export function insufficientStockPath(error: unknown): string {
  const units = availableUnitsOf(error)
  return `/sepet?hata=${INSUFFICIENT_STOCK}${units === null ? "" : `&${STOCK_COUNT_PARAM}=${String(units)}`}`
}

/** The cart page's sentence for the refusal, with the count from the address when it is one. */
export const insufficientStockText = (count: unknown, t: Translate): string => {
  const units = unitsOf(count)
  return units === null ? t(INSUFFICIENT_STOCK) : t(INSUFFICIENT_STOCK_COUNT, { count: units })
}

import "server-only"
import type { Translate } from "@qticaret/ui"
import { isStoreApiError } from "../store-api/errors"
import { storeGet } from "../store-api/server"

/** A cart line the shelf has too few of now. */
export interface ShortLine {
  title: string
  quantity: number
  short: number
}

/** The cart's error key when a line ran out since it was added (adr/0026 Ek 2026-11-06). */
export const OUT_OF_STOCK = "cart.out_of_stock"

/**
 * The cart's lines another order took the units of since they were put in
 * the cart (`GET /store/carts/:id/stock`, stocked − reserved as Medusa
 * counts it). An answer that does not come is no reason to stop checkout:
 * the payment's own start checks again.
 */
export async function cartShortLines(cartId: string): Promise<ShortLine[]> {
  try {
    const { short } = await storeGet<{ short: ShortLine[] }>(`/store/carts/${cartId}/stock`)
    return Array.isArray(short) ? short : []
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}

/** "Bu ürün az önce tükendi: Chuby / Kahverengi." with the lines' names; null when none is short. */
export const outOfStockText = (lines: readonly ShortLine[], t: Translate): string | null =>
  lines.length > 0 ? t(OUT_OF_STOCK, { name: lines.map((line) => line.title).join(", ") }) : null

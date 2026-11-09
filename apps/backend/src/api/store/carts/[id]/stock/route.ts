import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { readCartStock } from "../../../../../workflows/stock/cart-stock"

/**
 * GET /store/carts/:id/stock (adr/0026 Ek 2026-11-06): the cart's lines
 * the shelf has too few of now, as Medusa counts what is for sale
 * (stocked − reserved). The storefront asks as checkout opens, so a unit
 * another order took since it was put in the cart is seen before paying,
 * not after. Lines that are not tracked or sell past the shelf are never
 * named; a cart unknown has none. The cart id is the shopper's own
 * credential.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const stock = await readCartStock(req.scope, req.params["id"] ?? "")
  if (stock.completed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({
    short: stock.short.map(({ title, quantity, short }) => ({ title, quantity, short })),
  })
}

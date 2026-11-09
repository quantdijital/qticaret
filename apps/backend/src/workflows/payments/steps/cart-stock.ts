import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { readCartStock } from "../../stock/cart-stock"

/**
 * Stops a payment for units the shelf no longer has (adr/0026 Ek
 * 2026-11-06): what another order reserved since the line was added is
 * not for sale. Medusa checks the same count when a line is added; it does
 * not before a payment, and a card form paid for a unit gone becomes an
 * order short of stock. A variant that is not tracked, or sells past the
 * shelf, is never stopped.
 */
export const checkCartStockStep = createStep(
  "payments-check-cart-stock",
  async (cartId: string, { container }) => {
    const { short } = await readCartStock(container, cartId)
    if (short.length > 0) {
      throw new ValidationError("cart.out_of_stock", {
        field: "items",
        values: { name: short.map((line) => line.title).join(", ") },
      })
    }
    return new StepResponse(true)
  }
)

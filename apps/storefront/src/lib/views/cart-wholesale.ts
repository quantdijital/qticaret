import type { Translate } from "@qticaret/ui"
import type { Wholesale } from "@/lib/account/wholesale"
import type { CartLine } from "@/lib/cart/cart"

/** The message key the cart page says a wholesaler's minimum with (ADR-0068 §8). */
export const WHOLESALE_MINIMUM = "cart.wholesale_minimum"

/**
 * The backend's refusal of a code on a wholesaler's cart (ADR-0068 §6),
 * passed to the code field as its key; a theme that does not list it says
 * its own "code not valid" words instead.
 */
export const WHOLESALE_NO_CODE = "promotions.wholesale_no_code"

/**
 * The units a wholesale order counts toward its minimum (ADR-0068 §8), as
 * the backend counts them: the product lines' quantities (the fee of paying
 * at the door has no variant; add-on picks ride on their product's line).
 */
export const orderUnits = (lines: readonly Pick<CartLine, "quantity" | "variant_id">[]): number =>
  lines.reduce((sum, line) => (line.variant_id ? sum + line.quantity : sum), 0)

/**
 * "Toptan siparişte en az 10 adet gerekir; sepetinizde 4 adet var." for a
 * wholesaler's cart short of the minimum `/me/wholesale` gives; null for
 * anyone else, an empty cart or one that reaches it. Words only: the
 * backend refuses the payment itself (`wholesale.min_quantity`).
 */
export function wholesaleMinimumText(
  cart: { items: readonly Pick<CartLine, "quantity" | "variant_id">[] } | null,
  wholesale: Pick<Wholesale, "active" | "minQuantity">,
  t: Translate
): string | null {
  const min = wholesale.minQuantity
  if (!cart || !wholesale.active || min === null || min <= 0) {
    return null
  }
  const units = orderUnits(cart.items)
  return units > 0 && units < min ? t(WHOLESALE_MINIMUM, { min, units }) : null
}

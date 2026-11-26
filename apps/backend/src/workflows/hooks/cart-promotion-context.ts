import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import type { MedusaAmount } from "../../lib/money"
import { restrictionContext } from "../promotions/first-order"
import { freeShippingPromotionContext } from "../promotions/free-shipping-condition"
import { wholesalePromotionContext } from "../wholesale/promotions"
import type { PromotionCart } from "../wholesale/promotions"

// One handler per hook. Every promotion Medusa computes for a cart passes
// here (a cart's refresh after any change, codes added or taken off): an
// active wholesaler's cart takes none (ADR-0068 §6, Ek 2026-11-16), and a
// "first order only" rule reads whether the buyer ordered before and a guest
// record's groups are not read (K1/K2). A free shipping campaign lowers
// shipping only as the shop's free shipping condition allows (Settings >
// Shipping, "Koşul"). What is returned is laid over the cart Medusa's
// rules read. Reads only: nothing to undo.
updateCartPromotionsWorkflow.hooks.setPromotionContext(
  async (
    { cart, promo_codes }: { cart: unknown; promo_codes?: string[] | null },
    { container }
  ) => {
    const read = cart as
      (PromotionCart & { email?: string | null; item_total?: MedusaAmount | null }) | null
    const [wholesale, restrictions] = await Promise.all([
      wholesalePromotionContext(container, read),
      restrictionContext(container, read, promo_codes ?? []),
    ])
    // A wholesaler's cart already shows no shipping a campaign could lower
    const shipping = wholesale ? undefined : await freeShippingPromotionContext(container, read)
    const context = { ...wholesale, ...shipping, ...restrictions }
    return new StepResponse(Object.keys(context).length > 0 ? context : undefined)
  }
)

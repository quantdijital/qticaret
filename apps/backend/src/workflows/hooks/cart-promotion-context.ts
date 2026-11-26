import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { restrictionContext } from "../promotions/first-order"
import { wholesalePromotionContext } from "../wholesale/promotions"
import type { PromotionCart } from "../wholesale/promotions"

// One handler per hook. Every promotion Medusa computes for a cart passes
// here (a cart's refresh after any change, codes added or taken off): an
// active wholesaler's cart takes none (ADR-0068 §6, Ek 2026-11-16), and a
// "first order only" rule reads whether the buyer ordered before and a guest
// record's groups are not read (K1/K2). What
// is returned is laid over the cart Medusa's rules read. Reads only: nothing to undo.
updateCartPromotionsWorkflow.hooks.setPromotionContext(
  async (
    { cart, promo_codes }: { cart: unknown; promo_codes?: string[] | null },
    { container }
  ) => {
    const read = cart as (PromotionCart & { email?: string | null }) | null
    const [wholesale, restrictions] = await Promise.all([
      wholesalePromotionContext(container, read),
      restrictionContext(container, read, promo_codes ?? []),
    ])
    return new StepResponse(
      wholesale || Object.keys(restrictions).length > 0
        ? { ...wholesale, ...restrictions }
        : undefined
    )
  }
)

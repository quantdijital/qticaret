import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { wholesalePromotionContext } from "../wholesale/promotions"
import type { PromotionCart } from "../wholesale/promotions"

// One handler per hook. Every promotion Medusa computes for a cart passes
// here (a cart's refresh after any change, codes added or taken off): an
// active wholesaler's cart takes none (ADR-0068 §6, Ek 2026-11-16). What
// is returned is laid over the cart Medusa's rules read; nothing for any
// other cart. Reads only: nothing to undo.
updateCartPromotionsWorkflow.hooks.setPromotionContext(
  async ({ cart }: { cart: unknown }, { container }) =>
    new StepResponse(await wholesalePromotionContext(container, cart as PromotionCart | null))
)

import { updateLineItemInCartWorkflow } from "@medusajs/medusa/core-flows"
import { assertChangeWithinLimits } from "../checkout/purchase-limit"

// S5: a line's count raised past its product's most per order is refused;
// lowering it always passes. The workflow holds the cart's lock meanwhile
updateLineItemInCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await assertChangeWithinLimits(container, input.cart_id, input.item_id, input.update.quantity)
})

import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { refusePlainDatedItems } from "../booking/cart/plain-items"
import { assertAddWithinLimits } from "../checkout/purchase-limit"

// adr/0076 §5: a dated product's variant is added only through its booking
// route; a cart made with items goes through `validate-cart-tr-address.ts`.
// S5: a product's most per order counts what the cart already holds; the
// workflow holds the cart's lock while this runs
addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await refusePlainDatedItems(container, input.items)
  await assertAddWithinLimits(container, input.cart_id, input.items)
})

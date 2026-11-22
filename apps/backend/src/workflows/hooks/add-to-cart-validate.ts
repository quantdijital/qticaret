import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { refusePlainDatedItems } from "../booking/cart/plain-items"

// adr/0076 §5: a dated product's variant is added only through its booking
// route; a cart made with items goes through `validate-cart-tr-address.ts`
addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await refusePlainDatedItems(container, input.items)
})

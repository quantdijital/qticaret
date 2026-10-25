import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { checkoutProblem } from "../../lib/checkout"
import { ValidationError } from "../../lib/errors"

// One handler per hook: the checkout rules of lib/checkout (F3.2), read
// fresh for the cart being completed. Throwing stops the checkout.
// The hook's cart is typed loosely: only its id is used, the rest is read here
completeCartWorkflow.hooks.validate(async ({ cart }: { cart: { id: string } }, { container }) => {
  const cartId = cart.id
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["shipping_address.country_code", "items.requires_shipping", "shipping_methods.id"],
    filters: { id: cartId },
  })
  const problem = checkoutProblem(data[0] ?? {})
  if (problem) {
    throw new ValidationError(problem.key, { field: problem.field })
  }
})

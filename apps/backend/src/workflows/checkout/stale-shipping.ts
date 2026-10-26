import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { listShippingOptionsForCartWorkflow } from "@medusajs/medusa/core-flows"

interface MethodRow {
  amount?: unknown
  shipping_option_id?: string | null
}

interface OptionPrice {
  id: string
  price_type?: string | null
  amount?: unknown
}

/**
 * Whether a flat-rate shipping method on the cart costs other than its
 * option does for the cart now (F4.5). Medusa re-prices shipping when the
 * items change, not when a code is applied: a code that takes the basket
 * under the free-shipping threshold leaves its 0 TL method behind. Priced
 * by a carrier (calculated), a method is left to its provider.
 */
export async function hasStaleShipping(
  container: MedusaContainer,
  cartId: string
): Promise<boolean> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["shipping_methods.amount", "shipping_methods.shipping_option_id"],
    filters: { id: cartId },
  })
  const methods = (
    (data[0] as { shipping_methods?: (MethodRow | null)[] } | undefined)?.shipping_methods ?? []
  ).filter((method): method is MethodRow => Boolean(method?.shipping_option_id))
  if (methods.length === 0) {
    return false
  }
  const { result } = await listShippingOptionsForCartWorkflow(container).run({
    input: { cart_id: cartId },
  })
  const options = new Map((result as OptionPrice[]).map((option) => [option.id, option]))
  return methods.some((method) => {
    const option = options.get(method.shipping_option_id ?? "")
    return option?.price_type === "flat" && Number(option.amount) !== Number(method.amount)
  })
}

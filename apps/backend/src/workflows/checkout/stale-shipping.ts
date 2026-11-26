import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  listShippingOptionsForCartWithPricingWorkflow,
  listShippingOptionsForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"

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
 * Whether a free calculated method would cost something now: priced by our
 * quote (adr/0087 §2), it was free because the basket reached the
 * threshold. Asked again for those options alone; one that cannot be
 * priced any more is stale too (choosing it again says why).
 */
async function staleFreeCalculated(
  container: MedusaContainer,
  cartId: string,
  optionIds: string[]
): Promise<boolean> {
  if (optionIds.length === 0) {
    return false
  }
  try {
    const { result } = await listShippingOptionsForCartWithPricingWorkflow(container).run({
      input: { cart_id: cartId, options: optionIds.map((id) => ({ id })) },
    })
    const priced = new Map((result as OptionPrice[]).map((option) => [option.id, option]))
    return optionIds.some((id) => !isZero(priced.get(id)?.amount))
  } catch (error) {
    // Stale is the safe answer; the cause is kept for staff (security review 2026-11-26)
    logger.warn({
      event: "checkout.stale_shipping_reprice_failed",
      cartId,
      err: errorSummary(error),
    })
    return true
  }
}

/** Whether a Medusa amount is exactly zero; one that cannot be read is not. */
function isZero(amount: unknown): boolean {
  try {
    return fromMedusaAmount(amount as MedusaAmount, { allowRounding: true }) === 0
  } catch {
    return false
  }
}

/**
 * Whether a shipping method on the cart costs other than its option does
 * for the cart now (F4.5). Medusa re-prices shipping when the items
 * change, not when a code is applied: a code that takes the basket under
 * the free-shipping threshold leaves its 0 TL method behind. A flat-rate
 * method is compared with its option's price; a calculated one only while
 * it is free (adr/0087: the threshold holds for every option), so a
 * carrier's quote moving on is no reason to stop a checkout.
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
  const flatStale = methods.some((method) => {
    const option = options.get(method.shipping_option_id ?? "")
    return option?.price_type === "flat" && Number(option.amount) !== Number(method.amount)
  })
  if (flatStale) {
    return true
  }
  const freeCalculated = methods.flatMap((method) => {
    const option = options.get(method.shipping_option_id ?? "")
    // An amount that cannot be read is checked too
    const free = isZero(method.amount) || !Number.isFinite(Number(method.amount))
    return option?.price_type === "calculated" && free ? [option.id] : []
  })
  return staleFreeCalculated(container, cartId, freeCalculated)
}

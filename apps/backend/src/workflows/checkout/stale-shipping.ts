import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  listShippingOptionsForCartWithPricingWorkflow,
  listShippingOptionsForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { fromMedusaAmount } from "../../lib/money"
import type { Kurus, MedusaAmount } from "../../lib/money"
import { GELIVER_FULFILLMENT_PROVIDER_ID } from "../../lib/shipping/carriers"

interface MethodRow {
  amount?: unknown
  shipping_option_id?: string | null
}

interface OptionPrice {
  id: string
  price_type?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
  amount?: unknown
}

/** A Medusa amount in kuruş; null when it cannot be read. */
function kurusOf(amount: unknown): Kurus | null {
  try {
    return fromMedusaAmount(amount as MedusaAmount, { allowRounding: true })
  } catch {
    return null
  }
}

/**
 * Whether the shop prices the option itself, with no call outside (adr/0087
 * §2): a flat amount or the desi table. Its price for the cart now is
 * asked again at completion and must match. Geliver's quote moves on its
 * own: only a free one is asked again (the threshold, a free basket).
 */
const pricedByShop = (option: OptionPrice): boolean => {
  const id = option.data?.["id"]
  return (
    option.provider_id !== GELIVER_FULFILLMENT_PROVIDER_ID ||
    (typeof id === "string" && id.endsWith("-table"))
  )
}

/**
 * Whether any of these calculated methods would cost other than it did:
 * asked again for those options alone; one that cannot be priced any more
 * is stale too (choosing it again says why).
 */
async function stalePriced(
  container: MedusaContainer,
  cartId: string,
  methods: { option_id: string; amount: Kurus | null }[]
): Promise<boolean> {
  if (methods.length === 0) {
    return false
  }
  try {
    const { result } = await listShippingOptionsForCartWithPricingWorkflow(container).run({
      input: { cart_id: cartId, options: methods.map(({ option_id }) => ({ id: option_id })) },
    })
    const priced = new Map((result as OptionPrice[]).map((option) => [option.id, option]))
    return methods.some(({ option_id, amount }) => {
      const now = kurusOf(priced.get(option_id)?.amount)
      return now === null || amount === null || now !== amount
    })
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

/**
 * Whether a shipping method on the cart costs other than its option does
 * for the cart now (F4.5, adr/0087). Medusa re-prices shipping when the
 * items change, not when a code is applied or staff change a product's
 * shipping class: a method chosen before keeps its old amount. A flat-rate
 * method is compared with its option's price; a calculated one the shop
 * prices itself (flat amount, desi table) is priced again and compared
 * exactly; a carrier's quote only while it is free, so its quote moving on
 * is no reason to stop a checkout.
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
    input: { cart_id: cartId, fields: ["provider_id", "data"] },
  })
  const options = new Map((result as OptionPrice[]).map((option) => [option.id, option]))
  const flatStale = methods.some((method) => {
    const option = options.get(method.shipping_option_id ?? "")
    return option?.price_type === "flat" && Number(option.amount) !== Number(method.amount)
  })
  if (flatStale) {
    return true
  }
  const calculated = methods.flatMap((method) => {
    const option = options.get(method.shipping_option_id ?? "")
    if (option?.price_type !== "calculated") {
      return []
    }
    const amount = kurusOf(method.amount)
    // An amount that cannot be read is checked too
    return pricedByShop(option) || amount === null || amount === 0
      ? [{ option_id: option.id, amount }]
      : []
  })
  return stalePriced(container, cartId, calculated)
}

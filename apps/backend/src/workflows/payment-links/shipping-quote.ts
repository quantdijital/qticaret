import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { fromMedusaAmount, kurus, toMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { shippingQuote, thresholdKurus } from "../../lib/shipping/quote"
import { flatAmountOf } from "../../lib/shipping/shop"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

/** `priced`: `shipping_total` is the option's price; `at_checkout`: the checkout works it out. */
export type ShippingEstimate = "priced" | "at_checkout"

export interface ShippingQuote {
  /** Kuruş, KDV included; null when the checkout works it out. */
  shipping_total: number | null
  shipping_estimate: ShippingEstimate
}

export interface ShippingQuoteInput {
  shipping_option_id: string | null
  /** Whether staff gave the delivery address: a figure is for an address. */
  with_address: boolean
  region_id: string
  /** Kuruş: the lines after the discount, KDV in, as a cart's `item_total` would be. */
  item_total: number
}

interface OptionRow {
  price_type?: string | null
  data?: Record<string, unknown> | null
  calculated_price?: { calculated_amount?: MedusaAmount | null } | null
}

export const AT_CHECKOUT: ShippingQuote = { shipping_total: null, shipping_estimate: "at_checkout" }

/**
 * The preset option's price for the link's basket ("kargo tahmini",
 * adr/0051 §2), as Medusa prices it for a cart: a flat-rate option's stored
 * price for the lira region and the basket's `item_total`, so free shipping
 * from a basket total (F4.5) applies. A carrier-priced (`calculated`)
 * option is worked out by its provider against a cart's lines and address
 * (Medusa 2.21 prices one only for a cart: `calculateShippingOptionsPricesWorkflow`
 * takes a `cart_id`), so it waits for the checkout, as does a link without
 * an option or an address. Nothing comes from the request but the option.
 */
export async function quoteShipping(
  container: Container,
  input: ShippingQuoteInput
): Promise<ShippingQuote> {
  if (!input.shipping_option_id || !input.with_address) {
    return AT_CHECKOUT
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: ["id", "price_type", "data", "calculated_price.calculated_amount"],
    filters: { id: input.shipping_option_id },
    context: {
      calculated_price: QueryContext({
        currency_code: "try",
        region_id: input.region_id,
        // Lira, as the cart's own `item_total` reaches a price rule
        item_total: Number(toMedusaAmount(kurus(input.item_total))),
      }),
    },
  })
  const option = data[0] as OptionRow | undefined
  if (option?.price_type === "calculated" && option.data && "amount" in option.data) {
    return flatEstimate(container, option.data, input.item_total)
  }
  const amount = option?.price_type === "flat" ? option.calculated_price?.calculated_amount : null
  if (amount === null || amount === undefined) {
    return AT_CHECKOUT
  }
  return {
    shipping_total: fromMedusaAmount(amount, { allowRounding: true }),
    shipping_estimate: "priced",
  }
}

/**
 * A flat amount we price ourselves (adr/0087 §2): the option's amount, free
 * from the shop's basket threshold, as the checkout's quote charges it.
 */
async function flatEstimate(
  container: Container,
  data: Record<string, unknown>,
  itemTotal: number
): Promise<ShippingQuote> {
  let amount: ReturnType<typeof flatAmountOf>
  try {
    amount = flatAmountOf(data)
  } catch {
    return AT_CHECKOUT
  }
  const promotions = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("promotions")) as unknown as PromotionSettings
  const quoted = await shippingQuote({
    lines: [],
    basis: "order",
    context: {
      threshold: thresholdKurus(promotions.free_shipping_threshold),
      item_total: kurus(itemTotal),
    },
    price: () => amount,
  })
  return { shipping_total: quoted, shipping_estimate: "priced" }
}

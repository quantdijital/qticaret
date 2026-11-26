import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { estimateShipping, primaryOptionOf } from "../../lib/shipping/estimate"
import type { EstimatePricer, ShippingEstimate } from "../../lib/shipping/estimate"
import {
  ARAS_FULFILLMENT_PROVIDER_ID,
  GELIVER_FULFILLMENT_PROVIDER_ID,
  SHOP_FULFILLMENT_PROVIDER_ID,
  YURTICI_FULFILLMENT_PROVIDER_ID,
} from "../../lib/shipping/carriers"
import { flatAmountOf, tableBaseOf } from "../../lib/shipping/shop"
import type { CartLine } from "../../lib/shipping/shop"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { ShippingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { shippingQuoteContext } from "../hooks/shipping-quote-context"
import { shopShippingOptions } from "./shop-options"

interface CartRow {
  completed_at?: string | Date | null
  currency_code?: string | null
  items?: (CartLine | null)[] | null
}

interface OptionRow {
  provider_id?: string | null
  price_type?: string | null
  data?: Record<string, unknown> | null
}

const flat = (data: Record<string, unknown>): EstimatePricer<CartLine> => {
  const amount = flatAmountOf(data)
  return { basis: "order", price: () => amount }
}

const TABLE: EstimatePricer<CartLine> = { basis: "parcel", price: tableBaseOf }

/**
 * How the main option's base is priced before an address, chosen on the
 * same keys its provider's `calculatePrice` chooses on (adr/0087 §2;
 * security review 2026-11-26: never a figure checkout would not charge):
 * our shop provider's flat amount; Aras and Yurtiçi their `-flat` amount,
 * else the shop's desi table; Geliver's `geliver-table` the table. Geliver's
 * quote and an option Medusa prices itself are the checkout's to say: no
 * carrier is called from a cart page.
 */
export function pricerOf(option: OptionRow | null): EstimatePricer<CartLine> | null {
  if (option?.price_type !== "calculated") {
    return null
  }
  const data = option.data ?? {}
  const id = data["id"]
  switch (option.provider_id ?? "") {
    case SHOP_FULFILLMENT_PROVIDER_ID:
      return flat(data)
    case ARAS_FULFILLMENT_PROVIDER_ID:
      return id === "aras-flat" ? flat(data) : TABLE
    case YURTICI_FULFILLMENT_PROVIDER_ID:
      return id === "yurtici-flat" ? flat(data) : TABLE
    case GELIVER_FULFILLMENT_PROVIDER_ID:
      return id === "geliver-table" ? TABLE : null
    default:
      return null
  }
}

/**
 * The cart's shipping before an address (`GET /store/carts/:id/shipping-estimate`):
 * the shop's main option (Settings > Shipping "Kargo ücreti") through the
 * one quote checkout charges, with the cart's own basket, classes and the
 * shop's threshold read here. Reads only: nothing to undo. A cart unknown
 * or already an order is not found.
 */
export async function estimateCartShipping(
  container: MedusaContainer,
  cartId: string
): Promise<ShippingEstimate> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "completed_at",
      "currency_code",
      "items.id",
      "items.title",
      "items.product_title",
      "items.quantity",
      "items.product_id",
      "items.requires_shipping",
      "items.variant.weight",
      "items.variant.length",
      "items.variant.width",
      "items.variant.height",
    ],
    filters: { id: cartId },
  })
  const cart = data[0] as CartRow | undefined
  if (!cart || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "carts.unknown")
  }
  const lines = (cart.items ?? []).filter((item): item is CartLine => item !== null)
  // The quote's amounts are lira kuruş: another currency is the checkout's to price
  if (cart.currency_code?.toLowerCase() !== "try") {
    return estimateShipping({ lines, context: null, pricer: null, hasOption: false })
  }
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [shipping, options, context] = await Promise.all([
    settings.getSection("shipping") as Promise<unknown> as Promise<ShippingSettings>,
    shopShippingOptions(container),
    shippingQuoteContext(container, cartId),
  ])
  const primary = primaryOptionOf(options, shipping.primary_option_id)
  let pricer: EstimatePricer<CartLine> | null = null
  if (primary) {
    const { data: rows } = await query.graph({
      entity: "shipping_option",
      fields: ["provider_id", "price_type", "data"],
      filters: { id: primary.id },
    })
    try {
      pricer = pricerOf((rows[0] as OptionRow | undefined) ?? null)
    } catch {
      // A stored amount that cannot be read: the checkout says what it costs
      pricer = null
    }
  }
  return estimateShipping({ lines, context, pricer, hasOption: primary !== null })
}

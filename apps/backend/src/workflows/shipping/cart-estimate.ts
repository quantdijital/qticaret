import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { estimateShipping, primaryOptionOf } from "../../lib/shipping/estimate"
import type { EstimatePricer, ShippingEstimate } from "../../lib/shipping/estimate"
import { flatAmountOf, tableBaseOf } from "../../lib/shipping/shop"
import type { CartLine } from "../../lib/shipping/shop"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { ShippingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { shippingQuoteContext } from "../hooks/shipping-quote-context"
import { shopShippingOptions } from "./shop-options"

interface CartRow {
  completed_at?: string | Date | null
  items?: (CartLine | null)[] | null
}

interface OptionRow {
  price_type?: string | null
  data?: Record<string, unknown> | null
}

/**
 * How the main option's base is priced before an address, as its provider
 * prices it at checkout (adr/0087 §2): a flat amount we keep in its data,
 * per order; the shop's desi table on the paid lines' parcel. A carrier's
 * quote (Geliver) and an option Medusa prices itself are the checkout's to
 * say: no carrier is called from a cart page.
 */
export function pricerOf(option: OptionRow | null): EstimatePricer<CartLine> | null {
  if (option?.price_type !== "calculated") {
    return null
  }
  const data = option.data ?? {}
  if ("amount" in data) {
    const amount = flatAmountOf(data)
    return { basis: "order", price: () => amount }
  }
  const id = data["id"]
  return typeof id === "string" && id.endsWith("-table")
    ? { basis: "parcel", price: tableBaseOf }
    : null
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
      fields: ["price_type", "data"],
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

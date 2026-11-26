import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  calculateShippingOptionsPricesWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows"
import { QUOTE_CONTEXT_KEY, itemTotalKurus, thresholdKurus } from "../../lib/shipping/quote"
import type { ShippingQuoteContext } from "../../lib/shipping/quote"
import type { MedusaAmount } from "../../lib/money"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/**
 * What a calculated shipping price is worked out with (adr/0087 §2): the
 * shop's free shipping threshold and the cart's basket total, read here on
 * the server. Medusa lays the result over the provider's context (its own
 * fields win a clash; ours sit under one key of our own) and never takes it
 * from the request. One handler per hook: the options' listing (which
 * choosing and refreshing a method run too) and Medusa's single option
 * price route. Reads only: nothing to undo.
 */
export async function shippingQuoteContext(
  container: Pick<MedusaContainer, "resolve">,
  cartId: string | null | undefined
): Promise<ShippingQuoteContext | null> {
  if (!cartId) {
    return null
  }
  const [{ data }, promotions] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["id", "item_total"],
      filters: { id: cartId },
    }),
    container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .getSection("promotions") as Promise<unknown> as Promise<PromotionSettings>,
  ])
  const cart = data[0] as { item_total?: MedusaAmount | null } | undefined
  if (!cart) {
    return null
  }
  return {
    threshold: thresholdKurus(promotions.free_shipping_threshold),
    item_total: itemTotalKurus(cart.item_total),
  }
}

const handler = async (
  { input }: { input: { cart_id?: string | null } },
  { container }: { container: MedusaContainer }
) => {
  const context = await shippingQuoteContext(container, input.cart_id)
  return new StepResponse(context ? { [QUOTE_CONTEXT_KEY]: context } : undefined)
}

listShippingOptionsForCartWithPricingWorkflow.hooks.setCalculatedShippingPricingContext(handler)
calculateShippingOptionsPricesWorkflow.hooks.setCalculatedShippingPricingContext(handler)

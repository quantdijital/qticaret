import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  calculateShippingOptionsPricesWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows"
import { kurus } from "../../lib/money"
import { standaloneThreshold } from "../../lib/promotions/free-shipping"
import type { Kurus, MedusaAmount } from "../../lib/money"
import { QUOTE_CONTEXT_KEY, itemTotalKurus, thresholdKurus } from "../../lib/shipping/quote"
import type { ShippingQuoteContext } from "../../lib/shipping/quote"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings, ShippingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

interface CartRow {
  item_total?: MedusaAmount | null
  items?: ({ product_id?: string | null } | null)[] | null
}

interface ProductRow {
  id: string
  product_extension?: { shipping_class?: string | null } | null
}

/** The classes of the cart's products that have one (adr/0087 §1). */
async function classesOf(
  container: Pick<MedusaContainer, "resolve">,
  productIds: string[]
): Promise<Record<string, string>> {
  if (productIds.length === 0) {
    return {}
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "product_extension.shipping_class"],
    filters: { id: productIds },
  })
  return Object.fromEntries(
    (data as unknown as ProductRow[]).flatMap((product) => {
      const key = product.product_extension?.shipping_class
      return key ? [[product.id, key]] : []
    })
  )
}

/**
 * What a calculated shipping price is worked out with (adr/0087 §2): the
 * shop's free shipping threshold, the cart's basket total, its products'
 * shipping classes and the shop's class surcharges, read here on the
 * server. Medusa lays the result over the provider's context (its own
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
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [{ data }, promotions, shipping] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["id", "item_total", "items.product_id"],
      filters: { id: cartId },
    }),
    settings.getSection("promotions") as Promise<unknown> as Promise<PromotionSettings>,
    settings.getSection("shipping") as Promise<unknown> as Promise<ShippingSettings>,
  ])
  const cart = data[0] as CartRow | undefined
  if (!cart) {
    return null
  }
  const productIds = [
    ...new Set((cart.items ?? []).flatMap((item) => (item?.product_id ? [item.product_id] : []))),
  ]
  const surcharges: Record<string, Kurus> = Object.fromEntries(
    shipping.shipping_classes.map((each) => [each.key, kurus(each.surcharge)])
  )
  return {
    threshold: thresholdKurus(standaloneThreshold(promotions)),
    item_total: itemTotalKurus(cart.item_total),
    classes: await classesOf(container, productIds),
    surcharges,
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

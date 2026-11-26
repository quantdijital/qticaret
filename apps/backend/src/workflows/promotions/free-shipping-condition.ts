import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import type { MedusaAmount } from "../../lib/money"
import {
  campaignMayFreeShipping,
  freeShippingCodeRefusal,
  lowersShipping,
} from "../../lib/promotions/free-shipping"
import { itemTotalKurus } from "../../lib/shipping/quote"
import { promotionShells } from "../../lib/wholesale/cart"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PromotionSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The free shipping condition (Settings > Shipping > "Kargo ücreti",
 * "Koşul") held wherever a free shipping campaign could lower shipping:
 * Medusa's promotion computation, a code as it is sent, and the checkout.
 */

const promotionSettings = async (container: Container) =>
  (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("promotions")) as unknown as PromotionSettings

interface ShippedCart {
  item_total?: MedusaAmount | null
  shipping_methods?: readonly ({ id: string; adjustments?: unknown[] | null } | null)[] | null
}

/**
 * What Medusa's promotion rules see of the cart's shipping when no free
 * shipping campaign may lower it now: each method keeps its id and its
 * adjustments, so Medusa takes an old one off, but costs nothing, so no
 * campaign applies to it (the wholesale cart's way, `promotionShells`).
 * Undefined when a campaign may: the cart is read as it is.
 */
export async function freeShippingPromotionContext(
  container: Container,
  cart: ShippedCart | null | undefined
): Promise<{ shipping_methods: Record<string, unknown>[] } | undefined> {
  if (!cart || (cart.shipping_methods ?? []).length === 0) {
    return undefined
  }
  const settings = await promotionSettings(container)
  if (campaignMayFreeShipping(settings, itemTotalKurus(cart.item_total))) {
    return undefined
  }
  return {
    shipping_methods: promotionShells({ shipping_methods: cart.shipping_methods ?? null })
      .shipping_methods,
  }
}

/**
 * Why one of these codes may not lower the cart's shipping now, as the key
 * told to the shopper; null when every one may, or none is a free shipping
 * code. Medusa's computation holds the same line (it would only leave the
 * code off the cart); this says why.
 */
export async function freeShippingCodeRefusalOf(
  container: Container,
  codes: readonly string[],
  cartId: string | null
): Promise<string | null> {
  if (codes.length === 0) {
    return null
  }
  const promotions = await container
    .resolve(Modules.PROMOTION)
    .listPromotions({ code: [...codes], status: ["active"] }, { relations: ["application_method"] })
  if (!promotions.some((promotion) => lowersShipping(promotion.application_method))) {
    return null
  }
  const settings = await promotionSettings(container)
  let itemTotal: MedusaAmount | null = null
  if (cartId) {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["item_total"],
      filters: { id: cartId },
    })
    itemTotal = (data[0] as ShippedCart | undefined)?.item_total ?? null
  }
  return freeShippingCodeRefusal(settings, itemTotalKurus(itemTotal))
}

/**
 * At the checkout: shipping lowered by a campaign the condition no longer
 * allows (the basket fell below the total since, settings changed) stops
 * it. Choosing shipping again recomputes the cart's promotions.
 */
export async function assertFreeShippingConditionHolds(
  container: Container,
  cartId: string
): Promise<void> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["item_total", "shipping_methods.id", "shipping_methods.adjustments.amount"],
    filters: { id: cartId },
  })
  const cart = data[0] as
    | {
        item_total?: MedusaAmount | null
        shipping_methods?: ({ adjustments?: ({ amount?: unknown } | null)[] | null } | null)[]
      }
    | undefined
  const lowered = (cart?.shipping_methods ?? []).some((method) =>
    (method?.adjustments ?? []).some((adjustment) => Number(adjustment?.amount ?? 0) > 0)
  )
  if (!lowered) {
    return
  }
  const settings = await promotionSettings(container)
  if (!campaignMayFreeShipping(settings, itemTotalKurus(cart?.item_total))) {
    throw new ValidationError("cart.shipping_changed", { field: "shipping_methods" })
  }
}

/**
 * The same hold as the payment starts, under the cart's lock: shipping a
 * campaign lowered against the condition is refused before any money is
 * taken (security review 2026-11-26, L2), not only at the completion.
 */
export const assertFreeShippingConditionStep = createStep(
  "free-shipping-assert-condition",
  async (input: { cart_id: string }, { container }) => {
    await assertFreeShippingConditionHolds(container, input.cart_id)
    return new StepResponse(null)
  }
)

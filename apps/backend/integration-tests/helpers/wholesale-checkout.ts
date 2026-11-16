import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  linkCustomersToCustomerGroupWorkflow,
} from "@medusajs/medusa/core-flows"
import type { HttpClient } from "./http"
import { PAYTR_ADDRESS } from "./paytr"
import type { StockShop } from "./stock"
import { plain } from "./wholesale-store"
import type { Plain } from "./wholesale-store"

/** ADR-0068 slice 4: carts paid for as a shopper does, and their state as the database holds it. */

export const BANK = "pp_bank-transfer_bank-transfer"

/** Bank transfer on, with a made-up account whose check digits hold (as bank-transfer.spec.ts). */
export async function bankTransferOn(http: HttpClient, headers: Record<string, string>) {
  const saved = await plain(
    http.post(
      "/admin/platform-settings/bank_transfer",
      {
        enabled: true,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "tr33 0006 1005 1978 6457 8413 26",
        deadline_hours: 24,
      },
      { headers }
    )
  )
  if (saved.status !== 200) {
    throw new Error(`bank transfer not set: ${String(saved.status)}`)
  }
}

/**
 * A cart made and filled with these headers (a signed-in customer's, or
 * the storefront's alone for a guest, who then has no e-mail on it), its
 * address and the shop's shipping set: a customer's is ready to pay.
 * Needs the Turkish address list loaded.
 */
export async function readyShopperCart(
  http: HttpClient,
  container: MedusaContainer,
  shop: StockShop,
  headers: Record<string, string>,
  variantId: string,
  quantity = 1
): Promise<string> {
  const made = await plain(
    http.post<{ cart: { id: string } }>("/store/carts", { region_id: shop.regionId }, { headers })
  )
  const cartId = made.data.cart.id
  const steps = [
    await plain(
      http.post(
        `/store/carts/${cartId}/line-items`,
        { variant_id: variantId, quantity },
        { headers }
      )
    ),
    await plain(
      http.post(
        `/store/carts/${cartId}`,
        // A customer's cart carries their e-mail already
        { shipping_address: PAYTR_ADDRESS, billing_address: PAYTR_ADDRESS },
        { headers }
      )
    ),
  ]
  for (const step of [made, ...steps]) {
    if (step.status !== 200) {
      throw new Error(`cart not ready: ${String(step.status)} ${JSON.stringify(step.data)}`)
    }
  }
  await addShippingMethodToCartWorkflow(container).run({
    input: { cart_id: cartId, options: [{ id: shop.shippingOptionId }] },
  })
  return cartId
}

export const startPayment = (http: HttpClient, headers: Record<string, string>, cartId: string) =>
  plain(
    http.post<{ message?: string; values?: Record<string, string> }>(
      `/store/carts/${cartId}/payment-session`,
      { provider_id: BANK },
      { headers }
    )
  )

export const completeCart = (
  http: HttpClient,
  headers: Record<string, string>,
  cartId: string
): Promise<Plain<{ type?: string; order?: { id: string; total?: number }; message?: string }>> =>
  plain(http.post(`/store/carts/${cartId}/complete`, {}, { headers }))

/**
 * The customer taken out of a group the way a failed reprice leaves them
 * (review M1): Medusa's own workflow, the carts not priced again.
 */
export async function leaveGroup(container: MedusaContainer, groupId: string, customerId: string) {
  await linkCustomersToCustomerGroupWorkflow(container).run({
    input: { id: groupId, add: [], remove: [customerId] },
  })
}

export interface CartPrices {
  units: number[]
  discount: number
  codes: string[]
}

/** The cart's unit prices, discount and promotions as plain values. */
export async function cartPrices(container: MedusaContainer, cartId: string): Promise<CartPrices> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["discount_total", "items.unit_price", "promotions.code"],
    filters: { id: cartId },
  })
  const cart = data[0] as {
    discount_total?: unknown
    items?: { unit_price: unknown }[]
    promotions?: ({ code?: string | null } | null)[]
  }
  return {
    units: (cart.items ?? []).map((item) => Number(item.unit_price)),
    discount: Math.round(Number(cart.discount_total ?? 0) * 100) / 100,
    codes: (cart.promotions ?? []).flatMap((promotion) =>
      promotion?.code ? [promotion.code] : []
    ),
  }
}

/** A promotion made as the panel makes one (`/admin/promotions`); the body's own fields win. */
export async function makePromotion(
  http: HttpClient,
  headers: Record<string, string>,
  body: Record<string, unknown>
): Promise<void> {
  const made = await plain(
    http.post(
      "/admin/promotions",
      { type: "standard", is_tax_inclusive: true, status: "active", ...body },
      { headers }
    )
  )
  if (made.status !== 200) {
    throw new Error(`promotion not made: ${String(made.status)} ${JSON.stringify(made.data)}`)
  }
}

/** 10% off the whole order, automatic or by its code. */
export const orderPercent = (
  http: HttpClient,
  headers: Record<string, string>,
  code: string,
  automatic: boolean
) =>
  makePromotion(http, headers, {
    code,
    is_automatic: automatic,
    application_method: {
      type: "percentage",
      target_type: "order",
      allocation: "across",
      value: 10,
    },
  })

/** Adds a code to the cart as the storefront does. */
export const addCode = (
  http: HttpClient,
  cartId: string,
  headers: Record<string, string>,
  code: string
) =>
  plain(
    http.post<{ message?: string }>(
      `/store/carts/${cartId}/promotions`,
      { promo_codes: [code] },
      { headers }
    )
  )

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { addShippingMethodToCartWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import type { PaytrAccount } from "@qticaret/testing"
import { parseEnv } from "../../src/lib/env"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import { createAdminUser } from "./admin"
import type { HttpClient } from "./http"
import { settle } from "./http"
import type { StockShop } from "./stock"

/** F5: a cart ready to pay with PayTR, and the shop's PayTR account connected. */

export const PAYTR_ADDRESS = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "05320000000",
  address_1: "Atatürk Cad. No: 1",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: "34710",
  country_code: "tr",
}

/** `quantity` units of `variantId` with the shop's shipping; needs the Turkish address list loaded. */
export async function readyCart(
  container: MedusaContainer,
  shop: StockShop,
  variantId: string,
  address: Record<string, string> = PAYTR_ADDRESS,
  quantity = 1
): Promise<string> {
  const { result } = await createCartWorkflow(container).run({
    input: {
      region_id: shop.regionId,
      sales_channel_id: shop.salesChannelId,
      currency_code: "try",
      email: "ayse.yilmaz@example.com",
      items: [{ variant_id: variantId, quantity }],
      shipping_address: address,
      billing_address: address,
    },
  })
  await addShippingMethodToCartWorkflow(container).run({
    input: { cart_id: result.id, options: [{ id: shop.shippingOptionId }] },
  })
  return result.id
}

/** Connects `account` in test mode as the panel does; returns the admin who did. */
export async function connectPaytr(
  http: HttpClient,
  container: MedusaContainer,
  account: PaytrAccount
): Promise<{ headers: Record<string, string> }> {
  const admin = await createAdminUser(http, container)
  const saved = await settle(
    http.post(
      "/admin/integrations/credentials/paytr",
      {
        settings: { merchant_id: account.merchantId, test_mode: true },
        secrets: { merchant_key: account.merchantKey, merchant_salt: account.merchantSalt },
      },
      { headers: admin.headers }
    )
  )
  if (saved.status !== 200) {
    throw new Error(`connecting PayTR answered ${String(saved.status)}`)
  }
  return admin
}

/** Return addresses on the storefront's first origin (`STORE_CORS`). */
export function storeReturnUrls(): { success: string; failure: string } {
  const origin = (parseEnv().STORE_CORS.split(",")[0] ?? "").trim()
  return { success: `${origin}/odeme/tamam`, failure: `${origin}/odeme/hata` }
}

/** Starts a PayTR payment for the cart as a storefront does; PayTR's reference for it. */
export async function startPaytrPayment(
  http: HttpClient,
  headers: Record<string, string>,
  cartId: string
): Promise<string> {
  const started = await http.post<{ payment_session: { data: Record<string, unknown> } }>(
    `/store/carts/${cartId}/payment-session`,
    { provider_id: PAYTR_PAYMENT_PROVIDER_ID, return_urls: storeReturnUrls() },
    { headers }
  )
  return String(started.data.payment_session.data["merchant_oid"])
}

/** Posts a notification as PayTR does: a form body. */
export const notifyPaytr = (http: HttpClient, fields: Record<string, string>) =>
  settle(
    http.post<string>("/hooks/paytr", new URLSearchParams(fields).toString(), {
      headers: { "content-type": "application/x-www-form-urlencoded" },
    })
  )

/** The order a cart became, if any. */
export async function orderOfCart(
  container: MedusaContainer,
  cartId: string
): Promise<string | null> {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "cart", fields: ["order.id"], filters: { id: cartId } })
  return (data[0] as { order?: { id: string } | null } | undefined)?.order?.id ?? null
}

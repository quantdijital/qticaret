import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { FakeAras } from "@qticaret/testing"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "./admin"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { PAYTR_ADDRESS } from "./paytr"
import { stockShop, stockedProduct } from "./stock"
import type { StockShop } from "./stock"
import { loadTrAddressFixture } from "./tr-address"

/**
 * A shop shipping on its own Aras contract (adr/0035), the carrier the
 * shipping, return and invoice tests ship with: its account connected
 * against the fake, a contact, and an Aras option priced as asked (60 TL
 * flat unless told).
 */
export interface CarrierShop {
  shop: StockShop
  admin: { headers: Record<string, string> }
  optionId: string
  /** A product of 450 g in a 35 × 8 × 4 cm box (1 desi), stocked. */
  variantId: string
}

export type CarrierPricing = { type: "flat"; amount: number } | { type: "table" }

/** A stocked product, with the measures a carrier prices by unless `measured` is false. */
export async function measuredProduct(
  container: MedusaContainer,
  shop: StockShop,
  measured = true
): Promise<string> {
  const { variantId } = await stockedProduct(
    container,
    shop,
    `bicak-${String(Date.now())}-${String(Math.random()).slice(2, 6)}`,
    10,
    120
  )
  if (measured) {
    await container
      .resolve(Modules.PRODUCT)
      .updateProductVariants(variantId, { weight: 450, length: 35, width: 8, height: 4 })
  }
  return variantId
}

/** Connects the shop's Aras account against the fake (test mode). */
export const connectAras = (http: HttpClient, fake: FakeAras, headers: Record<string, string>) =>
  settle(
    http.post<{ message?: string }>(
      "/admin/integrations/credentials/aras",
      {
        settings: { test_mode: true, customer_code: "123456", service_url: "" },
        secrets: { username: fake.account.username, password: fake.account.password },
      },
      { headers }
    )
  )

export async function carrierShop(
  http: HttpClient,
  container: MedusaContainer,
  fake: FakeAras,
  pricing: CarrierPricing = { type: "flat", amount: 60 }
): Promise<CarrierShop> {
  await loadTrAddressFixture(container)
  const shop = await stockShop(container)
  const admin = await createAdminUser(http, container)
  await ensureLocationCarriers(container)
  await connectAras(http, fake, admin.headers)
  await http.post(
    "/admin/platform-settings/store",
    { contact_email: "magaza@example.com" },
    { headers: admin.headers }
  )
  const created = await settle(
    http.post<{ id: string; message?: string }>(
      "/admin/shipping-setup/options",
      { name: "Aras Kargo", carrier: "aras", pricing },
      { headers: admin.headers }
    )
  )
  if (!created.data.id) {
    throw new Error(`no Aras option: ${created.data.message ?? String(created.status)}`)
  }
  return {
    shop,
    admin,
    optionId: created.data.id,
    variantId: await measuredProduct(container, shop),
  }
}

/** An order of `variantId` (one unit, unless told), shipped with the Aras option, paid with the system provider. */
export const carrierOrder = (
  container: MedusaContainer,
  setup: CarrierShop,
  variantId = setup.variantId,
  quantity = 1
) =>
  placeOrder(container, {
    regionId: setup.shop.regionId,
    salesChannelId: setup.shop.salesChannelId,
    shippingOptionId: setup.optionId,
    items: [{ variant_id: variantId, quantity }],
    address: PAYTR_ADDRESS,
  })

/** "Kargoya ver" from the panel. */
export const shipOrder = (http: HttpClient, setup: CarrierShop, orderId: string) =>
  settle(
    http.post<{ order_id: string; carrier: string | null; message?: string }>(
      `/admin/orders/${orderId}/ship`,
      { notify: false },
      { headers: setup.admin.headers }
    )
  )

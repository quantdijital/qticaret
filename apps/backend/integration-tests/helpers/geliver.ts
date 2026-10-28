import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import type { FakeGeliver } from "@qticaret/testing"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "./admin"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { PAYTR_ADDRESS } from "./paytr"
import { stockShop, stockedProduct } from "./stock"
import type { StockShop } from "./stock"

/** A shop shipping with Geliver (F7, adr/0031): its account, a contact, a calculated option. */
export interface GeliverShop {
  shop: StockShop
  admin: { headers: Record<string, string> }
  optionId: string
  /** A product of 450 g in a 35 × 8 × 4 cm box (1 desi), stocked. */
  variantId: string
}

/** A stocked product, with the measures a carrier prices by unless `measured` is false. */
export async function geliverProduct(
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

export async function geliverShop(
  http: HttpClient,
  container: MedusaContainer,
  fake: FakeGeliver
): Promise<GeliverShop> {
  const shop = await stockShop(container)
  const admin = await createAdminUser(http, container)
  await http.post(
    "/admin/integrations/credentials/geliver",
    { settings: { test_mode: true }, secrets: { api_token: fake.token } },
    { headers: admin.headers }
  )
  await http.post(
    "/admin/platform-settings/store",
    { contact_email: "magaza@example.com" },
    { headers: admin.headers }
  )
  await ensureLocationCarriers(container)
  const { data: options } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "shipping_option",
    fields: ["service_zone_id"],
    filters: { id: shop.shippingOptionId },
  })
  const { result } = await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Geliver",
        price_type: "calculated",
        provider_id: "geliver_geliver",
        service_zone_id: (options[0] as { service_zone_id: string }).service_zone_id,
        shipping_profile_id: shop.shippingProfileId,
        data: { id: "geliver-cheapest" },
        type: { label: "Geliver", description: "Geliver", code: "geliver" },
        rules: [
          { attribute: "enabled_in_store", operator: "eq", value: "true" },
          { attribute: "is_return", operator: "eq", value: "false" },
        ],
      },
    ],
  })
  return {
    shop,
    admin,
    optionId: result[0]?.id ?? "",
    variantId: await geliverProduct(container, shop),
  }
}

/** An order of `variantId` (one unit, unless told), shipped with the Geliver option, paid with the system provider. */
export const geliverOrder = (
  container: MedusaContainer,
  setup: GeliverShop,
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
export const shipOrder = (http: HttpClient, setup: GeliverShop, orderId: string) =>
  settle(
    http.post<{ order_id: string; carrier: string | null; message?: string }>(
      `/admin/orders/${orderId}/ship`,
      { notify: false },
      { headers: setup.admin.headers }
    )
  )

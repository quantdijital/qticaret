import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createCartWorkflow,
  createShippingOptionsWorkflow,
  listShippingOptionsForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { SYSTEM_PAYMENT_PROVIDER_ID } from "../../src/scripts/bootstrap/constants"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

// The existing option a new one is modelled on
interface ModelRow {
  service_zone_id: string
  shipping_profile_id: string
  provider_id: string
  type: { label: string; description: string; code: string }
}

interface OptionRow {
  prices: { amount: unknown; price_rules?: { attribute: string }[] }[]
}

/** F4.5 (ADR-0024, KK): free shipping from a basket total, after discounts, KDV in. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    let variantId: string
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
      variantId = (await stockedProduct(getContainer(), shop, "kargo-esik", 50, 100)).variantId
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      await settings().saveSection("promotions", { free_shipping_threshold: null }, null)
    })

    const threshold = (value: number | null) =>
      settle(
        http.post(
          "/admin/platform-settings/promotions",
          { free_shipping_threshold: value },
          { headers: admin.headers }
        )
      )

    // What the shop's flat-rate option costs a basket of `quantity` units of 100 TL
    async function shipping(quantity: number, codes?: string[]): Promise<number> {
      const address = {
        first_name: "Ayşe",
        last_name: "Yılmaz",
        address_1: "Demo",
        country_code: "tr",
      }
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
          items: [{ variant_id: variantId, quantity }],
          shipping_address: address,
          billing_address: address,
          ...(codes ? { promo_codes: codes } : {}),
        },
      })
      const { result } = await listShippingOptionsForCartWorkflow(getContainer()).run({
        input: { cart_id: cart.id },
      })
      const option = (result as { id: string; amount?: number }[]).find(
        (each) => each.id === shop.shippingOptionId
      )
      return Number(option?.amount)
    }

    it("makes shipping free from the threshold, never below it (KK)", async () => {
      const paid = await shipping(1)
      expect(paid).toBeGreaterThan(0)
      expect((await threshold(200)).status).toBe(200)

      expect(await shipping(1)).toBe(paid)
      // Exactly the threshold counts, as Medusa's gte rule does
      expect(await shipping(2)).toBe(0)
      expect(await shipping(3)).toBe(0)
    })

    it("counts the basket after its discounts", async () => {
      await http.post(
        "/admin/promotions",
        {
          code: "yirmi",
          type: "standard",
          is_automatic: false,
          is_tax_inclusive: true,
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "order",
            allocation: "across",
            value: 20,
          },
        },
        { headers: admin.headers }
      )
      await threshold(250)
      // 300 less 20% is 240: under the threshold
      expect(await shipping(3, ["YIRMI"])).toBeGreaterThan(0)
      expect(await shipping(3)).toBe(0)
    })

    it("stops a checkout whose code took the basket under the threshold after shipping was chosen", async () => {
      await http.post(
        "/admin/promotions",
        {
          code: "YIRMI",
          type: "standard",
          is_automatic: false,
          is_tax_inclusive: true,
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "order",
            allocation: "across",
            value: 20,
          },
        },
        { headers: admin.headers }
      )
      await threshold(250)
      const store = await createStorefront(getContainer())
      const send = <T>(path: string, body: object) =>
        settle(http.post<T & { message?: string }>(path, body, { headers: store.headers }))
      const address = {
        first_name: "Ayşe",
        last_name: "Yılmaz",
        address_1: "Demo",
        country_code: "tr",
      }
      const made = await send<{ cart: { id: string } }>("/store/carts", {
        region_id: shop.regionId,
        items: [{ variant_id: variantId, quantity: 3 }],
        shipping_address: address,
      })
      const id = made.data.cart.id
      const chooseShipping = () =>
        send<{ cart: { shipping_total: number } }>(`/store/carts/${id}/shipping-methods`, {
          option_id: shop.shippingOptionId,
        })
      expect((await chooseShipping()).data.cart.shipping_total).toBe(0)
      // 300 less 20% is 240: under the threshold, but the method chosen at 300 stays 0 TL
      await send(`/store/carts/${id}/promotions`, { promo_codes: ["YIRMI"] })
      const collection = await send<{ payment_collection: { id: string } }>(
        "/store/payment-collections",
        { cart_id: id }
      )
      await send(
        `/store/payment-collections/${collection.data.payment_collection.id}/payment-sessions`,
        { provider_id: SYSTEM_PAYMENT_PROVIDER_ID }
      )
      const refused = await send(`/store/carts/${id}/complete`, {})
      expect({ status: refused.status, message: refused.data.message }).toEqual({
        status: 400,
        message: "cart.shipping_changed",
      })
      // Chosen again, it costs what the basket now pays
      expect((await chooseShipping()).data.cart.shipping_total).toBeGreaterThan(0)
    })

    it("takes free shipping away with the threshold, and gives it to a new option", async () => {
      await threshold(200)
      await threshold(null)
      expect(await shipping(3)).toBeGreaterThan(0)

      await threshold(200)
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "shipping_option",
          fields: [
            "id",
            "service_zone_id",
            "shipping_profile_id",
            "provider_id",
            "type.label",
            "type.description",
            "type.code",
          ],
          filters: { id: shop.shippingOptionId },
        })
      const model = data[0] as unknown as ModelRow
      const { result } = await createShippingOptionsWorkflow(getContainer()).run({
        input: [
          {
            name: "Hızlı Kargo",
            service_zone_id: model.service_zone_id,
            shipping_profile_id: model.shipping_profile_id,
            provider_id: model.provider_id,
            price_type: "flat",
            type: model.type,
            prices: [{ currency_code: "try", amount: 150 }],
            rules: [],
          },
        ],
      })
      const created = result[0]?.id ?? ""
      // The subscriber adds the free price after the event
      let prices: OptionRow["prices"] = []
      for (let attempt = 0; attempt < 50 && prices.length < 2; attempt++) {
        const read = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "shipping_option",
            fields: ["prices.amount", "prices.price_rules.attribute"],
            filters: { id: created },
          })
        prices = (read.data[0] as unknown as OptionRow | undefined)?.prices ?? []
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(prices.map((price) => Number(price.amount)).sort((a, b) => a - b)).toEqual([0, 150])
    })
  },
})

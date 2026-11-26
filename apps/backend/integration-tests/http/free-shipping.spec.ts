import { createPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createCartWorkflow,
  createShippingOptionsWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { completeWithSystemPayment } from "../helpers/checkout"
import { convertFlatShippingOptionsWorkflow } from "../../src/workflows/shipping/flat-to-calculated"

jest.setTimeout(240 * 1000)

// The existing option a new one is modelled on
interface ModelRow {
  service_zone_id: string
  shipping_profile_id: string
  provider_id: string
  type: { label: string; description: string; code: string }
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
    async function shipping(
      quantity: number,
      codes?: string[],
      optionId: string = shop.shippingOptionId
    ): Promise<number> {
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
      const { result } = await listShippingOptionsForCartWithPricingWorkflow(getContainer()).run({
        input: { cart_id: cart.id },
      })
      const option = (result as { id: string; amount?: number }[]).find(
        (each) => each.id === optionId
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
      // Medusa's own collection route is closed to shoppers (security review 2026-11-02)
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({
        input: { cart_id: id },
      })
      const refused = await completeWithSystemPayment(getContainer(), id, collection.id)
      expect(refused).toEqual({ order_id: null, message: "cart.shipping_changed" })
      // Chosen again, it costs what the basket now pays
      expect((await chooseShipping()).data.cart.shipping_total).toBeGreaterThan(0)
    })

    it("takes free shipping away with the threshold", async () => {
      await threshold(200)
      expect(await shipping(3)).toBe(0)
      await threshold(null)
      expect(await shipping(3)).toBeGreaterThan(0)
    })

    // adr/0087 §7: a flat-rate option made the old way (Medusa Admin, a region's price)
    async function legacyFlatOption(name: string, prices: object[]): Promise<string> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "shipping_option",
          fields: ["service_zone_id", "shipping_profile_id", "type.label", "type.description"],
          filters: { id: shop.shippingOptionId },
        })
      const model = data[0] as unknown as ModelRow
      const { result } = await createShippingOptionsWorkflow(getContainer()).run({
        input: [
          {
            name,
            service_zone_id: model.service_zone_id,
            shipping_profile_id: model.shipping_profile_id,
            provider_id: "manual_manual",
            price_type: "flat",
            type: { label: name, description: name, code: "manual" },
            prices,
            rules: [
              { attribute: "enabled_in_store", operator: "eq", value: "true" },
              { attribute: "is_return", operator: "eq", value: "false" },
            ],
          },
        ] as never,
      })
      return result[0]?.id ?? ""
    }

    it("moves flat-rate options to our pricing once, the threshold then holding for them", async () => {
      const plain = await legacyFlatOption("Hızlı Kargo", [{ currency_code: "try", amount: 150 }])
      const region = await legacyFlatOption("Bölge Kargo", [
        { region_id: shop.regionId, amount: 120 },
      ])

      const first = await convertFlatShippingOptionsWorkflow(getContainer()).run()
      const again = await convertFlatShippingOptionsWorkflow(getContainer()).run()
      expect(first.result).toBe(2)
      expect(again.result).toBe(0)

      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "shipping_option",
          fields: ["id", "price_type", "provider_id", "data", "prices.amount"],
          filters: { id: [plain, region] },
        })
      const rows = data as unknown as {
        id: string
        price_type: string
        provider_id: string
        data: Record<string, unknown>
        prices?: unknown[]
      }[]
      expect(rows.find((row) => row.id === plain)).toMatchObject({
        price_type: "calculated",
        provider_id: "shop_shop",
        data: { id: "shop-flat", amount: 15_000 },
      })
      expect(rows.find((row) => row.id === region)?.data).toEqual({
        id: "shop-flat",
        amount: 12_000,
      })

      expect((await threshold(250)).status).toBe(200)
      expect(await shipping(2, undefined, region)).toBe(120)
      expect(await shipping(3, undefined, region)).toBe(0)
      expect(await shipping(3, undefined, plain)).toBe(0)
    })

    it("keeps a new flat-rate option from the panel on our pricing, and its new amount", async () => {
      const created = await settle(
        http.post<{ id: string }>(
          "/admin/shipping-setup/options",
          { name: "Kendi Kargom", carrier: "manual", pricing: { type: "flat", amount: 75.5 } },
          { headers: admin.headers }
        )
      )
      const id = created.data.id
      expect(await shipping(1, undefined, id)).toBe(75.5)
      await settle(
        http.post(`/admin/shipping-setup/options/${id}`, { amount: 80 }, { headers: admin.headers })
      )
      expect(await shipping(1, undefined, id)).toBe(80)
      await threshold(100)
      expect(await shipping(1, undefined, id)).toBe(0)
    })
  },
})

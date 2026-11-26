import {
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeAras } from "@qticaret/testing"
import type { FakeAras } from "@qticaret/testing"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { completeWithSystemPayment } from "../helpers/checkout"
import { carrierShop } from "../helpers/carrier"
import type { CarrierShop } from "../helpers/carrier"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface PricedOption {
  id: string
  amount?: unknown
}

/**
 * adr/0087 §2.5: "X TL üzeri kargo bedava" holds for every option, not
 * only flat-rate ones: a carrier's flat amount and the shop's desi table
 * (Aras, Yurtiçi) are free from the threshold too, worked out on the
 * server without asking the carrier.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeAras
    let setup: CarrierShop
    let storefront: Storefront
    let tableOptionId: string
    let yurticiOptionId: string

    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const store = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: storefront.headers }))

    beforeAll(async () => {
      fake = await startFakeAras()
      process.env["ARAS_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["ARAS_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      storefront = await createStorefront(container)
      setup = await carrierShop(http, container, fake)
      // A 1 desi parcel costs 49.90 by the shop's table
      await post("/admin/platform-settings/shipping", {
        rate_table: [{ max_desi: 10, price: 4_990 }],
      })
      const created = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "Aras Kargo",
        carrier: "aras",
        pricing: { type: "table" },
      })
      tableOptionId = created.data.id
      const yurtici = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "Yurtiçi Kargo",
        carrier: "yurtici",
        pricing: { type: "table" },
      })
      yurticiOptionId = yurtici.data.id
      fake.requests.length = 0
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("promotions", { free_shipping_threshold: null }, null)
    })

    const threshold = (value: number | null) =>
      post("/admin/platform-settings/promotions", { free_shipping_threshold: value })

    // The product costs 120 TL a unit (measuredProduct)
    const cartOf = async (quantity: number) =>
      (
        await createCartWorkflow(getContainer()).run({
          input: {
            region_id: setup.shop.regionId,
            sales_channel_id: setup.shop.salesChannelId,
            currency_code: "try",
            items: [{ variant_id: setup.variantId, quantity }],
            shipping_address: PAYTR_ADDRESS,
            billing_address: PAYTR_ADDRESS,
          },
        })
      ).result.id

    const pricesOf = async (cartId: string) => {
      const { result } = await listShippingOptionsForCartWithPricingWorkflow(getContainer()).run({
        input: { cart_id: cartId },
      })
      const options = result as PricedOption[]
      const amountOf = (id: string) => Number(options.find((option) => option.id === id)?.amount)
      return {
        table: amountOf(tableOptionId),
        yurtici: amountOf(yurticiOptionId),
        flat: amountOf(setup.optionId),
      }
    }

    it("makes the desi table and a carrier's flat amount free from the threshold, asking no carrier", async () => {
      expect((await threshold(200)).status).toBe(200)

      // 120 TL: under the threshold, each option at its own price
      expect(await pricesOf(await cartOf(1))).toEqual({ table: 49.9, yurtici: 49.9, flat: 60 })

      // 240 TL: past it, free with every option
      expect(await pricesOf(await cartOf(2))).toEqual({ table: 0, yurtici: 0, flat: 0 })
      expect(fake.requests).toHaveLength(0)

      // Medusa's single option price route holds it too
      const single = await store<{ shipping_option: { amount: number } }>(
        `/store/shipping-options/${tableOptionId}/calculate`,
        { cart_id: await cartOf(2), data: {} }
      )
      expect(single.status).toBe(200)
      expect(single.data.shipping_option.amount).toBe(0)
    })

    it("charges every option with no threshold set", async () => {
      const prices = await pricesOf(await cartOf(3))
      expect(prices).toEqual({ table: 49.9, yurtici: 49.9, flat: 60 })
    })

    it("takes nothing a shopper sends for the price", async () => {
      await threshold(200)
      const cartId = await cartOf(1)
      // What our hook would say, forged in the method's data: the price stays the table's
      const chosen = await store<{ cart: { shipping_total: number } }>(
        `/store/carts/${cartId}/shipping-methods`,
        {
          option_id: tableOptionId,
          data: { qt_shipping: { threshold: 0, item_total: 1_000_000 } },
        }
      )
      expect(chosen.status).toBe(200)
      expect(chosen.data.cart.shipping_total).toBe(49.9)
      // Nor on Medusa's single option price route
      const single = await store<{ shipping_option: { amount: number } }>(
        `/store/shipping-options/${tableOptionId}/calculate`,
        { cart_id: cartId, data: { qt_shipping: { threshold: 0, item_total: 1_000_000 } } }
      )
      expect(single.data.shipping_option.amount).toBe(49.9)
    })

    it("stops a checkout whose code took the basket under the threshold after a free table option was chosen", async () => {
      await post("/admin/promotions", {
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
      })
      await threshold(200)
      const cartId = await cartOf(2)
      const choose = () =>
        store<{ cart: { shipping_total: number } }>(`/store/carts/${cartId}/shipping-methods`, {
          option_id: tableOptionId,
        })
      expect((await choose()).data.cart.shipping_total).toBe(0)
      // 240 less 20% is 192: under the threshold, but the method chosen at 240 stays 0 TL
      await store(`/store/carts/${cartId}/promotions`, { promo_codes: ["YIRMI"] })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: cartId } })
      const refused = await completeWithSystemPayment(getContainer(), cartId, collection.id)
      expect(refused).toEqual({ order_id: null, message: "cart.shipping_changed" })
      // Chosen again, it costs what the basket now pays
      expect((await choose()).data.cart.shipping_total).toBe(49.9)
    })
  },
})

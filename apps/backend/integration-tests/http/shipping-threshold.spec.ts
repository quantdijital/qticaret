import {
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { completeWithSystemPayment } from "../helpers/checkout"
import { geliverShop } from "../helpers/geliver"
import type { GeliverShop } from "../helpers/geliver"
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
 * only flat-rate ones: the shop's desi table (Aras) and Geliver's quote
 * are free from the threshold too, worked out on the server.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let setup: GeliverShop
    let storefront: Storefront
    let tableOptionId: string
    let yurticiOptionId: string

    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const store = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: storefront.headers }))
    const quotesAsked = () =>
      fake.requests.filter((request) => request.path.includes("priceList")).length

    beforeAll(async () => {
      fake = await startFakeGeliver()
      process.env["GELIVER_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["GELIVER_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      storefront = await createStorefront(container)
      setup = await geliverShop(http, container, fake)
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

    // The product costs 120 TL a unit (geliverProduct)
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
        geliver: amountOf(setup.optionId),
      }
    }

    it("makes the desi table and Geliver free from the threshold, without asking Geliver", async () => {
      expect((await threshold(200)).status).toBe(200)

      // 120 TL: under the threshold, each option at its own price
      expect(await pricesOf(await cartOf(1))).toEqual({ table: 49.9, yurtici: 49.9, geliver: 60 })
      expect(quotesAsked()).toBeGreaterThan(0)

      // 240 TL: past it, free with every option, and Geliver is not asked
      fake.requests.length = 0
      expect(await pricesOf(await cartOf(2))).toEqual({ table: 0, yurtici: 0, geliver: 0 })
      expect(quotesAsked()).toBe(0)

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
      expect(prices).toMatchObject({ table: 49.9, yurtici: 49.9 })
      expect(prices.geliver).toBeGreaterThan(0)
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

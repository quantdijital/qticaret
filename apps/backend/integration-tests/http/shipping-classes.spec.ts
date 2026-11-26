import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
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
import { geliverProduct, geliverShop } from "../helpers/geliver"
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
 * adr/0087 §2 (the owner's answers 2026-11-26): a product's shipping class
 * priced by every option on the server: a basket of free products ships
 * free, a mixed one pays the paid products' parcel (a flat amount in
 * full), the highest surcharge once; nothing a shopper sends changes it.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let setup: GeliverShop
    let storefront: Storefront
    let tableOptionId: string
    let freeVariant: string
    let paidVariant: string

    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const store = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: storefront.headers }))
    const quotesAsked = () =>
      fake.requests.filter((request) => request.path.includes("priceList")).length

    const productOf = async (variantId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product_variant", fields: ["product_id"], filters: { id: variantId } })
      return (data[0] as { product_id: string }).product_id
    }
    const classify = async (variantId: string, shippingClass: string | null) =>
      post(`/admin/products/${await productOf(variantId)}/catalog`, {
        shipping_class: shippingClass,
      })

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
      // 10 TL a desi up to 10; the shop's own classes: bulky +150, heavy +250
      await post("/admin/platform-settings/shipping", {
        rate_table: [
          { max_desi: 1, price: 1_000 },
          { max_desi: 2, price: 2_000 },
          { max_desi: 10, price: 5_000 },
        ],
        shipping_classes: [
          { key: "bulky", name: "Büyük ürün", surcharge: 15_000 },
          { key: "heavy", name: "Ağır ürün", surcharge: 25_000 },
        ],
      })
      tableOptionId = (
        await post<{ id: string }>("/admin/shipping-setup/options", {
          name: "Aras Kargo",
          carrier: "aras",
          pricing: { type: "table" },
        })
      ).data.id
      freeVariant = setup.variantId
      paidVariant = await geliverProduct(container, setup.shop)
      expect((await classify(freeVariant, "free")).status).toBe(200)
      fake.requests.length = 0
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.saveSection("shipping", { shipping_classes: [], rate_table: [] }, null)
      await settings.saveSection("promotions", { free_shipping_threshold: null }, null)
    })

    const cartOf = async (items: { variant_id: string; quantity: number }[]) =>
      (
        await createCartWorkflow(getContainer()).run({
          input: {
            region_id: setup.shop.regionId,
            sales_channel_id: setup.shop.salesChannelId,
            currency_code: "try",
            items,
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
        flat: amountOf(setup.shop.shippingOptionId),
        table: amountOf(tableOptionId),
        geliver: amountOf(setup.optionId),
      }
    }

    it("ships a basket of free products free with every option, Geliver not asked", async () => {
      expect(await pricesOf(await cartOf([{ variant_id: freeVariant, quantity: 3 }]))).toEqual({
        flat: 0,
        table: 0,
        geliver: 0,
      })
      expect(quotesAsked()).toBe(0)
    })

    it("prices a mixed basket by the paid product alone, a flat amount in full", async () => {
      const cartId = await cartOf([
        { variant_id: freeVariant, quantity: 5 },
        { variant_id: paidVariant, quantity: 1 },
      ])
      // The seed's standard option is 90 TL; the paid product is 1 desi: 10 TL, MNG 60
      expect(await pricesOf(cartId)).toEqual({ flat: 90, table: 10, geliver: 60 })
    })

    it("adds the highest surcharge once, and the new class reaches a cart already priced", async () => {
      const cartId = await cartOf([{ variant_id: paidVariant, quantity: 2 }])
      const chosen = await store<{ cart: { shipping_total: number } }>(
        `/store/carts/${cartId}/shipping-methods`,
        { option_id: setup.shop.shippingOptionId }
      )
      expect(chosen.data.cart.shipping_total).toBe(90)

      expect((await classify(paidVariant, "heavy")).status).toBe(200)
      expect(await pricesOf(cartId)).toMatchObject({ flat: 340, table: 260 })
      // A change to the cart re-prices its method with the class it has now
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["items.id"], filters: { id: cartId } })
      const lineId = (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
      const updated = await store<{ cart: { shipping_total: number } }>(
        `/store/carts/${cartId}/line-items/${lineId}`,
        { quantity: 1 }
      )
      expect(updated.data.cart.shipping_total).toBe(340)
    })

    it("drops the surcharge past the threshold, the free products' amounts counted", async () => {
      await classify(paidVariant, "bulky")
      await post("/admin/platform-settings/promotions", { free_shipping_threshold: 240 })
      // 120 + 120: the free product's amount takes the basket to the threshold
      const cartId = await cartOf([
        { variant_id: freeVariant, quantity: 1 },
        { variant_id: paidVariant, quantity: 1 },
      ])
      expect(await pricesOf(cartId)).toEqual({ flat: 0, table: 0, geliver: 0 })
    })

    it("takes nothing a shopper sends, and refuses a class the shop does not have", async () => {
      await classify(paidVariant, "bulky")
      const cartId = await cartOf([{ variant_id: paidVariant, quantity: 1 }])
      const chosen = await store<{ cart: { shipping_total: number } }>(
        `/store/carts/${cartId}/shipping-methods`,
        {
          option_id: setup.shop.shippingOptionId,
          data: { amount: 0, qt_shipping: { classes: {}, surcharges: {}, item_total: 0 } },
        }
      )
      expect(chosen.data.cart.shipping_total).toBe(240)

      const refused = await classify(paidVariant, "imaginary")
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("shipping.class_unknown")
    })

    it("stops a checkout whose product changed class after its paid method was chosen", async () => {
      const cartId = await cartOf([{ variant_id: paidVariant, quantity: 1 }])
      const chosen = await store<{ cart: { shipping_total: number } }>(
        `/store/carts/${cartId}/shipping-methods`,
        { option_id: setup.shop.shippingOptionId }
      )
      expect(chosen.data.cart.shipping_total).toBe(90)
      // Staff move it to a class with a surcharge: the 90 TL method is stale now
      await classify(paidVariant, "heavy")
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: cartId } })
      const refused = await completeWithSystemPayment(getContainer(), cartId, collection.id)
      expect(refused).toEqual({ order_id: null, message: "cart.shipping_changed" })
    })

    it("counts the products in each class for the settings card", async () => {
      await classify(paidVariant, "bulky")
      const { data } = await http.get<{ usage: Record<string, number> }>(
        "/admin/shipping-setup/classes",
        { headers: setup.admin.headers }
      )
      expect(data.usage).toEqual({ free: 1, bulky: 1 })
    })
  },
})

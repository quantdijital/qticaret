import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeAras } from "@qticaret/testing"
import type { FakeAras } from "@qticaret/testing"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { completeWithSystemPayment } from "../helpers/checkout"
import { measuredProduct, carrierShop } from "../helpers/carrier"
import type { CarrierShop } from "../helpers/carrier"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface Estimate {
  status: "free" | "priced" | "at_checkout" | "not_needed"
  amount: number | null
}

/**
 * The cart's shipping before an address (WooCommerce's shipping
 * calculator, 2026-11-26): the shop's main option priced on the server by
 * the quote checkout charges (adr/0087 §2): the threshold, the classes,
 * the desi table; no carrier is asked from a cart page. Nothing a shopper
 * sends changes the answer.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeAras
    let setup: CarrierShop
    let storefront: Storefront
    let variant: string

    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const estimateOf = (cartId: string, query = "") =>
      settle(
        http.get<{ shipping_estimate: Estimate; message?: string }>(
          `/store/carts/${cartId}/shipping-estimate${query}`,
          { headers: storefront.headers }
        )
      )
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
    // No address: the estimate never needs one
    const cartOf = async (quantity = 1, withAddress = false) =>
      (
        await createCartWorkflow(getContainer()).run({
          input: {
            region_id: setup.shop.regionId,
            sales_channel_id: setup.shop.salesChannelId,
            currency_code: "try",
            items: [{ variant_id: variant, quantity }],
            ...(withAddress
              ? { shipping_address: PAYTR_ADDRESS, billing_address: PAYTR_ADDRESS }
              : {}),
          },
        })
      ).result.id

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
      // An Aras option by the table: the seed's flat one stays the cheapest flat
      setup = await carrierShop(http, container, fake, { type: "table" })
      await post("/admin/platform-settings/shipping", {
        rate_table: [
          { max_desi: 1, price: 1_000 },
          { max_desi: 10, price: 5_000 },
        ],
        shipping_classes: [{ key: "bulky", name: "Büyük ürün", surcharge: 15_000 }],
      })
      // 120 TL a unit, 1 desi
      variant = await measuredProduct(container, setup.shop)
      fake.requests.length = 0
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.saveSection(
        "shipping",
        { shipping_classes: [], rate_table: [], primary_option_id: null },
        null
      )
      await settings.saveSection(
        "promotions",
        { free_shipping_threshold: null, free_shipping_condition: "amount_or_coupon" },
        null
      )
    })

    it("prices the main flat option without an address, ignoring anything sent", async () => {
      const cartId = await cartOf()
      const { status, data } = await estimateOf(cartId)
      expect(status).toBe(200)
      // The seed's standard option: 90 TL, the cheapest flat one
      expect(data.shipping_estimate).toEqual({ status: "priced", amount: 90 })
      const sent = await estimateOf(cartId, "?amount=0&item_total=99999&option_id=x")
      expect(sent.data.shipping_estimate).toEqual({ status: "priced", amount: 90 })
    })

    it("is free from the threshold on the cart's own total, the amount left below it", async () => {
      await post("/admin/platform-settings/promotions", { free_shipping_threshold: 240 })
      const below = await estimateOf(await cartOf(1))
      expect(below.data.shipping_estimate).toEqual({ status: "priced", amount: 90 })
      const at = await estimateOf(await cartOf(2))
      expect(at.data.shipping_estimate).toEqual({ status: "free", amount: null })
    })

    it("is never free by the total alone when the shop asks for a coupon too", async () => {
      // "Tutar ve kupon": a free shipping campaign frees it at checkout, never the total
      await post("/admin/platform-settings/promotions", {
        free_shipping_threshold: 240,
        free_shipping_condition: "amount_and_coupon",
      })
      expect((await estimateOf(await cartOf(3))).data.shipping_estimate).toEqual({
        status: "priced",
        amount: 90,
      })
    })

    it("adds a class's surcharge, and a free-shipping product's basket is free", async () => {
      expect((await classify(variant, "bulky")).status).toBe(200)
      expect((await estimateOf(await cartOf())).data.shipping_estimate).toEqual({
        status: "priced",
        amount: 240,
      })
      expect((await classify(variant, "free")).status).toBe(200)
      expect((await estimateOf(await cartOf())).data.shipping_estimate).toEqual({
        status: "free",
        amount: null,
      })
    })

    it("prices a desi table main option by the cart's parcel", async () => {
      const table = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "Aras Kargo",
        carrier: "aras",
        pricing: { type: "table" },
      })
      await post("/admin/platform-settings/shipping", { primary_option_id: table.data.id })
      // 1 desi: 10 TL; three units are 3 desi: 50 TL
      expect((await estimateOf(await cartOf(1))).data.shipping_estimate).toEqual({
        status: "priced",
        amount: 10,
      })
      expect((await estimateOf(await cartOf(3))).data.shipping_estimate).toEqual({
        status: "priced",
        amount: 50,
      })
    })

    it("never asks the carrier from a cart page, with an address or shipping free", async () => {
      await post("/admin/platform-settings/shipping", { primary_option_id: setup.optionId })
      expect((await estimateOf(await cartOf(1, true))).data.shipping_estimate).toEqual({
        status: "priced",
        amount: 10,
      })
      await post("/admin/platform-settings/promotions", { free_shipping_threshold: 100 })
      expect((await estimateOf(await cartOf())).data.shipping_estimate).toEqual({
        status: "free",
        amount: null,
      })
      expect(fake.requests).toHaveLength(0)
    })

    it("does not find a cart unknown or already an order", async () => {
      expect((await estimateOf("cart_unknown")).status).toBe(404)
      const cartId = await cartOf(1, true)
      const added = await settle(
        http.post(
          `/store/carts/${cartId}/shipping-methods`,
          { option_id: setup.shop.shippingOptionId },
          { headers: storefront.headers }
        )
      )
      expect(added.status).toBe(200)
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: cartId } })
      const placed = await completeWithSystemPayment(getContainer(), cartId, collection.id)
      expect(placed.order_id).toBeTruthy()
      expect((await estimateOf(cartId)).status).toBe(404)
    })
  },
})

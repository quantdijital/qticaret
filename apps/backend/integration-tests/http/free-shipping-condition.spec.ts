import { createPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type { FreeShippingCondition } from "../../src/modules/platform-settings/sections/promotions"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import { completeWithSystemPayment } from "../helpers/checkout"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface CartBody {
  cart: { id: string; shipping_total: number; promotions?: { code: string }[] }
}

const CART_FIELDS = "id,shipping_total,*promotions"

/**
 * Settings > Shipping > "Kargo ücreti", "Koşul" (WooCommerce's "Free
 * shipping requires"): what frees shipping beside the basket total, held
 * on the server wherever a free shipping campaign could lower it: the
 * shipping price, Medusa's promotion computation, a code as it is sent,
 * the checkout and what the storefront is told.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    let store: Storefront
    let variantId: string

    const adminPost = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: admin.headers }))
    const send = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: store.headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
      // 100 TL a unit
      variantId = (await stockedProduct(getContainer(), shop, "kargo-kosul", 50, 100)).variantId
      const code = await adminPost("/admin/promotions", {
        code: "KARGOBEDAVA",
        type: "standard",
        is_automatic: false,
        status: "active",
        application_method: {
          type: "percentage",
          target_type: "shipping_methods",
          allocation: "each",
          value: 100,
        },
      })
      expect(code.status).toBe(200)
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection(
          "promotions",
          { free_shipping_threshold: null, free_shipping_condition: "amount_or_coupon" },
          null
        )
    })

    const freeFrom = (threshold: number | null, condition?: FreeShippingCondition) =>
      adminPost("/admin/platform-settings/promotions", {
        free_shipping_threshold: threshold,
        ...(condition ? { free_shipping_condition: condition } : {}),
      })

    /** A cart of `quantity` units with the shop's option chosen; its id and what shipping costs. */
    async function cartWithShipping(quantity: number) {
      const made = await send<CartBody>("/store/carts", {
        region_id: shop.regionId,
        items: [{ variant_id: variantId, quantity }],
        shipping_address: {
          first_name: "Ayşe",
          last_name: "Yılmaz",
          address_1: "Demo",
          country_code: "tr",
        },
      })
      const id = made.data.cart.id
      const chosen = await send<CartBody>(
        `/store/carts/${id}/shipping-methods?fields=${CART_FIELDS}`,
        { option_id: shop.shippingOptionId }
      )
      return { id, shipping: chosen.data.cart.shipping_total }
    }

    const addCode = (cartId: string) =>
      send<CartBody>(`/store/carts/${cartId}/promotions?fields=${CART_FIELDS}`, {
        promo_codes: ["KARGOBEDAVA"],
      })

    const shownThreshold = async () =>
      (
        await settle(
          http.get<{ free_shipping_threshold: number | null }>("/store/storefront", {
            headers: store.headers,
          })
        )
      ).data.free_shipping_threshold

    it("frees shipping by the total or a code when no condition was ever chosen", async () => {
      expect((await freeFrom(250)).status).toBe(200)
      const settings = await settle(
        http.get<{ values: { free_shipping_condition: string } }>(
          "/admin/platform-settings/promotions",
          { headers: admin.headers }
        )
      )
      expect(settings.data.values.free_shipping_condition).toBe("amount_or_coupon")

      // Past the total: free without a code
      expect((await cartWithShipping(3)).shipping).toBe(0)
      // Below it: the code frees it
      const below = await cartWithShipping(1)
      expect(below.shipping).toBeGreaterThan(0)
      const taken = await addCode(below.id)
      expect(taken.status).toBe(200)
      expect(taken.data.cart.shipping_total).toBe(0)
      expect(await shownThreshold()).toBe(250)
    })

    it("frees shipping by the total alone in amount mode, a code refused with why", async () => {
      await freeFrom(250, "amount")
      expect((await cartWithShipping(3)).shipping).toBe(0)

      const below = await cartWithShipping(1)
      const refused = await addCode(below.id)
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("promotions.free_shipping_code_off")
      expect(await shownThreshold()).toBe(250)
    })

    it("takes an automatic free shipping campaign off in amount mode", async () => {
      await adminPost("/admin/promotions", {
        code: "OTOKARGO",
        type: "standard",
        is_automatic: true,
        status: "active",
        application_method: {
          type: "percentage",
          target_type: "shipping_methods",
          allocation: "each",
          value: 100,
        },
      })
      await freeFrom(250, "amount_or_coupon")
      expect((await cartWithShipping(1)).shipping).toBe(0)
      await freeFrom(250, "amount")
      expect((await cartWithShipping(1)).shipping).toBeGreaterThan(0)
    })

    it("needs the total and a code together in and mode", async () => {
      await freeFrom(250, "amount_and_coupon")

      // The total alone frees nothing, and the storefront is not told it does
      const past = await cartWithShipping(3)
      expect(past.shipping).toBeGreaterThan(0)
      expect(await shownThreshold()).toBeNull()

      // A code below the total does not lower shipping: refused with why
      const below = await cartWithShipping(1)
      const refused = await addCode(below.id)
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("promotions.free_shipping_code_below_total")

      // The total and the code: free
      const taken = await addCode(past.id)
      expect(taken.status).toBe(200)
      expect(taken.data.cart.shipping_total).toBe(0)

      // The basket falls below the total: the refresh takes the free shipping off
      const cart = await settle(
        http.get<{ cart: { items: { id: string }[] } }>(`/store/carts/${past.id}`, {
          headers: store.headers,
        })
      )
      const lineId = cart.data.cart.items[0]?.id ?? ""
      const smaller = await send<CartBody>(
        `/store/carts/${past.id}/line-items/${lineId}?fields=${CART_FIELDS}`,
        { quantity: 1 }
      )
      expect(smaller.data.cart.shipping_total).toBeGreaterThan(0)
    })

    it("stops a checkout whose free shipping the condition no longer allows", async () => {
      await freeFrom(250, "amount_or_coupon")
      const below = await cartWithShipping(1)
      expect((await addCode(below.id)).data.cart.shipping_total).toBe(0)
      // The shop now wants the total too: the cart still shows the free shipping it had
      await freeFrom(250, "amount_and_coupon")
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: below.id } })
      const refused = await completeWithSystemPayment(getContainer(), below.id, collection.id)
      expect(refused).toEqual({ order_id: null, message: "cart.shipping_changed" })
      // Chosen again, it costs what the basket now pays
      const again = await send<CartBody>(
        `/store/carts/${below.id}/shipping-methods?fields=${CART_FIELDS}`,
        { option_id: shop.shippingOptionId }
      )
      expect(again.data.cart.shipping_total).toBeGreaterThan(0)
    })

    it("keeps free shipping codes as any campaign while no total is set", async () => {
      await freeFrom(null, "amount")
      const cart = await cartWithShipping(1)
      expect(cart.shipping).toBeGreaterThan(0)
      expect((await addCode(cart.id)).data.cart.shipping_total).toBe(0)
    })

    it("refuses a condition the shop does not have", async () => {
      const refused = await freeFrom(250, "anything" as FreeShippingCondition)
      expect(refused.status).toBe(400)
    })
  },
})

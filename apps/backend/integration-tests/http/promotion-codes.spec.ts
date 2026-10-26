import { Modules, PromotionActions } from "@medusajs/framework/utils"
import {
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  updateCartPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { SYSTEM_PAYMENT_PROVIDER_ID } from "../../src/scripts/bootstrap/constants"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { shippedCart } from "../helpers/gift-cards"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface Cart {
  id: string
  discount_total: number
  promotions?: { code: string }[]
}

const CART_FIELDS = "id,discount_total,*promotions"

/** F4.4/F4.6 (ADR-0024): codes in one form, one per cart, tries limited, a limit kept under races. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let variantId: string

    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    async function promotion(code: string, extra: Record<string, unknown> = {}) {
      const made = await settle(
        http.post<{ promotion: { id: string; code: string } }>(
          "/admin/promotions",
          {
            code,
            type: "standard",
            is_automatic: false,
            is_tax_inclusive: true,
            status: "active",
            application_method: {
              type: "percentage",
              target_type: "order",
              allocation: "across",
              value: 10,
            },
            ...extra,
          },
          { headers: admin.headers }
        )
      )
      expect(made.status).toBe(200)
      return made.data.promotion
    }

    const storePost = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: store.headers }))

    async function cart(quantity = 1, codes?: string[]) {
      const made = await storePost<{ cart: Cart }>(`/store/carts?fields=${CART_FIELDS}`, {
        region_id: shop.regionId,
        items: [{ variant_id: variantId, quantity }],
        ...(codes ? { promo_codes: codes } : {}),
      })
      expect(made.status).toBe(200)
      return made.data.cart
    }

    const addCodes = (cartId: string, codes: string[]) =>
      storePost<{ cart: Cart }>(`/store/carts/${cartId}/promotions?fields=${CART_FIELDS}`, {
        promo_codes: codes,
      })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      shop = await stockShop(getContainer())
      variantId = (await stockedProduct(getContainer(), shop, "kupon-kupa", 50)).variantId
    })

    it("saves a code in capitals and applies one however it is typed", async () => {
      expect((await promotion("yaz-İndirim")).code).toBe("YAZ-INDIRIM")
      const { id } = await cart()
      const applied = await addCodes(id, ["Yaz-indirim"])
      expect(applied.status).toBe(200)
      expect(applied.data.cart.promotions?.map((each) => each.code)).toEqual(["YAZ-INDIRIM"])
      expect(applied.data.cart.discount_total).toBe(10)
    })

    it("takes one code per cart unless the shop combines them", async () => {
      await promotion("BIR")
      await promotion("IKI")
      const { id } = await cart(1, ["bir"])
      const second = await addCodes(id, ["iki"])
      expect(second.status).toBe(400)
      expect(second.data.message).toBe("promotions.one_code")
      const both = await storePost(`/store/carts/${id}`, { promo_codes: ["bir", "iki"] })
      expect(both.status).toBe(400)
      // Swapping the code for another is one code
      expect((await storePost(`/store/carts/${id}`, { promo_codes: ["iki"] })).status).toBe(200)

      await settings().saveSection("promotions", { combine_codes: true }, null)
      try {
        const combined = await addCodes(id, ["bir"])
        expect(combined.status).toBe(200)
        expect(combined.data.cart.promotions?.map((each) => each.code).sort()).toEqual([
          "BIR",
          "IKI",
        ])
      } finally {
        // The settings cache outlives the database reset between tests
        await settings().saveSection("promotions", { combine_codes: false }, null)
      }
    })

    it("limits the codes a cart may try", async () => {
      const { id } = await cart()
      const tries: number[] = []
      for (let attempt = 0; attempt < 11; attempt++) {
        tries.push((await addCodes(id, [`YOK${String(attempt)}`])).status)
      }
      expect(tries.slice(0, 10).every((status) => status === 400)).toBe(true)
      expect(tries[10]).toBe(429)
    })

    it("applies a minimum cart rule on the items' total", async () => {
      await promotion("ASGARI", {
        rules: [{ attribute: "item_total", operator: "gte", values: ["150"] }],
      })
      const small = await cart(1)
      const tooSmall = await addCodes(small.id, ["asgari"])
      // Refused, or kept without a discount: either way nothing off below the line
      expect(tooSmall.status === 400 || tooSmall.data.cart.discount_total === 0).toBe(true)
      const big = await cart(2)
      const applied = await addCodes(big.id, ["asgari"])
      expect(applied.status).toBe(200)
      expect(applied.data.cart.discount_total).toBe(20)
    })

    // A cart holding `codes`, made by the workflow straight (as requests racing
    // each other could leave it), then completed as a shopper does
    async function completeWith(codes: string[]) {
      const id = await shippedCart(getContainer(), shop, variantId)
      await updateCartPromotionsWorkflow(getContainer()).run({
        input: { cart_id: id, promo_codes: codes, action: PromotionActions.ADD },
      })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(
        getContainer()
      ).run({ input: { cart_id: id } })
      await createPaymentSessionsWorkflow(getContainer()).run({
        input: { payment_collection_id: collection.id, provider_id: SYSTEM_PAYMENT_PROVIDER_ID },
      })
      return storePost<{ type?: string }>(`/store/carts/${id}/complete`, {})
    }

    it("refuses a checkout whose cart took two codes past the one-code check", async () => {
      await promotion("BIR")
      await promotion("IKI")
      const refused = await completeWith(["BIR", "IKI"])
      expect({ status: refused.status, message: refused.data.message }).toEqual({
        status: 400,
        message: "promotions.one_code",
      })
      await settings().saveSection("promotions", { combine_codes: true }, null)
      try {
        expect((await completeWith(["BIR", "IKI"])).data).toMatchObject({ type: "order" })
      } finally {
        await settings().saveSection("promotions", { combine_codes: false }, null)
      }
    })

    it("takes at most five codes a request, and plain codes from the admin", async () => {
      const six = ["K1X", "K2X", "K3X", "K4X", "K5X", "K6X"]
      const sent = await storePost("/store/carts", {
        region_id: shop.regionId,
        promo_codes: six,
      })
      expect(sent.status).toBe(400)
      const formula = await settle(
        http.post(
          "/admin/promotions",
          {
            code: "=1+1",
            type: "standard",
            status: "active",
            application_method: { type: "percentage", target_type: "order", value: 10 },
          },
          { headers: admin.headers }
        )
      )
      expect(formula.status).toBe(400)
    })

    it("shows a shopper their own promotion only, never the rest of its campaign", async () => {
      const campaign = await http.post<{ campaign: { id: string } }>(
        "/admin/campaigns",
        { name: "Parti", campaign_identifier: "parti-gizli" },
        { headers: admin.headers }
      )
      await promotion("GIZLI-AAAA", { campaign_id: campaign.data.campaign.id })
      await promotion("GIZLI-BBBB", { campaign_id: campaign.data.campaign.id })
      const { id } = await cart(1, ["GIZLI-AAAA"])
      for (const fields of [
        "promotions.campaign.promotions.code",
        "*promotions",
        "items.adjustments.promotion.campaign.promotions.code",
      ]) {
        const read = await settle(
          http.get(`/store/carts/${id}?fields=${fields}`, { headers: store.headers })
        )
        expect(JSON.stringify(read.data)).not.toContain("GIZLI-BBBB")
      }
    })

    it("lets a code limited to one use be used once, however many checkouts race (KK)", async () => {
      const { id } = await promotion("TEK", { limit: 1 })
      const order = () =>
        placeOrder(getContainer(), {
          ...shop,
          items: [{ variant_id: variantId, quantity: 1 }],
          promo_codes: ["TEK"],
          address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
        })
      const results = await Promise.allSettled([order(), order(), order()])
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
      const [saved] = await getContainer()
        .resolve(Modules.PROMOTION)
        .listPromotions({ id: [id] }, { select: ["used", "limit"] })
      expect(saved).toMatchObject({ used: 1, limit: 1 })
    })
  },
})

import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
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

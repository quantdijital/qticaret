import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PRICE_HISTORY_MODULE } from "../../src/modules/price-history"
import type PriceHistoryModuleService from "../../src/modules/price-history/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const DAY = 24 * 60 * 60 * 1000
const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString()

interface SaleRead {
  currency_code: string
  variants: {
    id: string
    regular: string | null
    sale: {
      amount: string
      starts_at: string | null
      ends_at: string | null
      running: boolean
    } | null
  }[]
}

/**
 * adr/0086: a variant's sale price (Woo's "İndirimli fiyat") set on the
 * product, with optional days: the cart charges it only while it runs,
 * the storefront strikes through the price-before rule's price, and the
 * list stays off the price lists screen.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
    })

    const url = (productId: string) => `/admin/products/${productId}/sale-prices`
    const send = (productId: string, body: unknown) =>
      settle(http.post<SaleRead>(url(productId), body, { headers: admin.headers }))
    const read = async (productId: string) =>
      (await settle(http.get<SaleRead>(url(productId), { headers: admin.headers }))).data

    // What a guest's cart of one unit charges for its items
    async function cartItems(variantId: string): Promise<number> {
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
          items: [{ variant_id: variantId, quantity: 1 }],
        },
      })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["item_total"], filters: { id: cart.id } })
      return Math.round(Number((data[0] as { item_total: unknown }).item_total) * 100) / 100
    }

    async function recorded(variantId: string, count: number) {
      const history = getContainer().resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await history.listPriceRecords({ variant_id: variantId, currency_code: "try" })
        if (rows.length >= count) {
          return
        }
        await pause(100)
      }
      throw new Error(`${variantId} has fewer than ${String(count)} records`)
    }

    it("sells at the sale price, cart included, and strikes through the price before it", async () => {
      const { productId, variantId } = await stockedProduct(
        getContainer(),
        shop,
        "indirimli",
        5,
        100
      )
      await recorded(variantId, 1)

      const set = await send(productId, { set: [{ variant_id: variantId, amount: "79.90" }] })
      expect(set.status).toBe(200)
      expect(set.data.variants).toEqual([
        {
          id: variantId,
          regular: "100.00",
          sale: { amount: "79.90", starts_at: null, ends_at: null, running: true },
        },
      ])
      expect(await cartItems(variantId)).toBe(79.9)

      await recorded(variantId, 2)
      const shown = await settle(
        http.get<{ price_display: Record<string, Record<string, unknown>> }>(
          `/store/price-display?variant_id=${variantId}&currency_code=try`,
          { headers: store.headers }
        )
      )
      expect(shown.data.price_display[variantId]).toMatchObject({
        current: "79.90",
        regular: "100.00",
        before: "100.00",
        on_sale: true,
      })

      // Cleared: the variant's own price again
      const cleared = await send(productId, { clear: [variantId] })
      expect(cleared.data.variants[0]?.sale).toBeNull()
      expect(await cartItems(variantId)).toBe(100)
    })

    it("works a percentage out on the server and replaces the sale, never two at once", async () => {
      const { productId, variantId } = await stockedProduct(
        getContainer(),
        shop,
        "yuzdeli",
        5,
        33.33
      )
      await send(productId, { set: [{ variant_id: variantId, percent: 15 }] })
      expect((await read(productId)).variants[0]?.sale?.amount).toBe("28.33")

      await send(productId, { set: [{ variant_id: variantId, amount: "30.00" }] })
      expect((await read(productId)).variants[0]?.sale?.amount).toBe("30.00")
      expect(await cartItems(variantId)).toBe(30)
    })

    it("waits for a scheduled sale and ends one when its day is over", async () => {
      const { productId, variantId } = await stockedProduct(getContainer(), shop, "zamanli", 5, 100)
      const later = await send(productId, {
        set: [
          {
            variant_id: variantId,
            amount: "50.00",
            starts_at: fromNow(DAY),
            ends_at: fromNow(2 * DAY),
          },
        ],
      })
      expect(later.data.variants[0]?.sale).toMatchObject({ amount: "50.00", running: false })
      // Not begun: the cart charges the regular price
      expect(await cartItems(variantId)).toBe(100)

      await send(productId, {
        set: [{ variant_id: variantId, amount: "60.00", ends_at: fromNow(3000) }],
      })
      expect(await cartItems(variantId)).toBe(60)
      await pause(3500)
      // Over: the regular price again, and the panel shows no sale
      expect(await cartItems(variantId)).toBe(100)
      expect((await read(productId)).variants[0]?.sale).toBeNull()
    })

    it("refuses a sale not below the regular price, dates out of order and another product's variant", async () => {
      const { productId, variantId } = await stockedProduct(getContainer(), shop, "ret", 5, 100)
      const other = await stockedProduct(getContainer(), shop, "baska", 5, 100)
      const refused = async (body: unknown) => (await send(productId, body)).status
      expect(await refused({ set: [{ variant_id: variantId, amount: "100.00" }] })).toBe(400)
      expect(
        await refused({
          set: [
            {
              variant_id: variantId,
              amount: "50.00",
              starts_at: fromNow(2 * DAY),
              ends_at: fromNow(DAY),
            },
          ],
        })
      ).toBe(400)
      expect(await refused({ set: [{ variant_id: other.variantId, amount: "50.00" }] })).toBe(400)
      expect(await refused({ set: [{ variant_id: variantId, amount: "50", percent: 10 }] })).toBe(
        400
      )
      expect(await cartItems(variantId)).toBe(100)
    })

    it("keeps the sale lists off the price lists screen and its writes", async () => {
      const { productId, variantId } = await stockedProduct(getContainer(), shop, "gizli", 5, 100)
      await send(productId, { set: [{ variant_id: variantId, amount: "80.00" }] })
      const lists = await settle(
        http.get<{ price_lists: { id: string }[]; count: number }>("/admin/price-lists", {
          headers: admin.headers,
        })
      )
      expect(lists.data).toMatchObject({ price_lists: [], count: 0 })

      const pricing = getContainer().resolve("pricing") as {
        listPriceLists: (f: object, c: object) => Promise<{ id: string }[]>
      }
      const [list] = await pricing.listPriceLists({}, { select: ["id"] })
      const write = await settle(
        http.post(
          `/admin/price-lists/${list?.id ?? ""}`,
          { title: "Başka" },
          { headers: admin.headers }
        )
      )
      expect(write.status).toBe(409)
    })
  },
})

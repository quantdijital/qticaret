import {
  createPriceListsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
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

interface Display {
  current: string
  regular: string
  before: string | null
  on_sale: boolean
  since: string | null
  basis: string | null
  rule_version: string
}

/** F4.3 (ADR-0023, KK): a discount shown struck through only as the price-before rule allows. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
    })

    // The variant's history, once its `count` records are written (events arrive after the write)
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

    const setPrice = (variantId: string, amount: number) =>
      updateProductVariantsWorkflow(getContainer()).run({
        input: {
          product_variants: [{ id: variantId, prices: [{ currency_code: "try", amount }] }],
        },
      })

    const saleList = (variantId: string, amount: number) =>
      createPriceListsWorkflow(getContainer()).run({
        input: {
          price_lists_data: [
            {
              title: `İndirim ${String(amount)}`,
              description: "",
              status: "active",
              prices: [{ variant_id: variantId, amount, currency_code: "try" }],
            },
          ],
        },
      })

    const display = (query: string) =>
      settle(
        http.get<{ price_display: Record<string, Display> }>(`/store/price-display?${query}`, {
          headers: store.headers,
        })
      )

    it("shows a sale struck through at the price before it (KK)", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "gosterim-indirim", 5, 100)
      await recorded(variantId, 1)
      await saleList(variantId, 80)
      await recorded(variantId, 2)

      const read = await display(`variant_id=${variantId}&currency_code=try`)
      expect(read.status).toBe(200)
      const shown = read.data.price_display[variantId]
      expect(shown).toMatchObject({
        current: "80.00",
        regular: "100.00",
        before: "100.00",
        on_sale: true,
        basis: "history",
        rule_version: "tr-10d-1",
      })
      // When the sale began: the list's price, as recorded
      expect(Number.isNaN(Date.parse(shown?.since ?? ""))).toBe(false)
    })

    it("does not show a cut back to a price of the last 10 days as a discount", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "gosterim-geri", 5, 80)
      await recorded(variantId, 1)
      // Raised to 100, then a "sale" back to the 80 it sold at days ago
      await setPrice(variantId, 100)
      await recorded(variantId, 2)
      await saleList(variantId, 80)
      await recorded(variantId, 3)

      const read = await display(`variant_id=${variantId}&currency_code=TRY`)
      expect(read.data.price_display[variantId]).toMatchObject({
        current: "80.00",
        regular: "100.00",
        before: null,
        on_sale: false,
      })
    })

    it("gives the page's structured data the same price and strikethrough (KK)", async () => {
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      try {
        const { variantId } = await stockedProduct(getContainer(), shop, "gosterim-sayfa", 5, 100)
        await recorded(variantId, 1)
        await saleList(variantId, 80)
        await recorded(variantId, 2)

        const shown = (await display(`variant_id=${variantId}&currency_code=try`)).data
          .price_display[variantId]
        const page = await settle(
          http.get<{ seo?: { jsonLd: Record<string, unknown>[] } }>(
            `/store/seo/resolve?path=${encodeURIComponent("/urun/gosterim-sayfa")}`,
            { headers: store.headers }
          )
        )
        const product = page.data.seo?.jsonLd.find((block) => block["@type"] === "Product")
        expect(product?.["offers"]).toMatchObject({
          price: shown?.current,
          priceSpecification: {
            priceType: "https://schema.org/StrikethroughPrice",
            price: shown?.before,
          },
        })
      } finally {
        // The settings cache outlives the database reset between tests
        await settings.saveSection("seo", { canonical_host: null }, null)
      }
    })

    it("shows the shop a variant's 90 days and why a discount is not struck through", async () => {
      const admin = await createAdminUser(http, getContainer())
      const { productId, variantId } = await stockedProduct(getContainer(), shop, "gecmis", 5, 80)
      await recorded(variantId, 1)
      await setPrice(variantId, 100)
      await recorded(variantId, 2)
      await saleList(variantId, 80)
      await recorded(variantId, 3)

      const read = await settle(
        http.get<{
          rule_version: string
          variants: {
            id: string
            display: Record<string, unknown> | null
            points: { amount: string; original: string }[]
          }[]
        }>(`/admin/products/${productId}/price-history?currency_code=try`, {
          headers: admin.headers,
        })
      )
      expect(read.status).toBe(200)
      const [variant] = read.data.variants
      expect(variant?.points.map((point) => [point.amount, point.original])).toEqual([
        ["80.00", "80.00"],
        ["100.00", "100.00"],
        ["80.00", "100.00"],
      ])
      // Discounted, but 80 sold days ago: the rule's price is shown to the shop, not struck through
      expect(variant?.display).toMatchObject({
        current: "80.00",
        regular: "100.00",
        before: null,
        lowest_before: "80.00",
        on_sale: false,
      })
      const missing = await settle(
        http.get("/admin/products/prod_unknown/price-history?currency_code=try", {
          headers: admin.headers,
        })
      )
      expect(missing.status).toBe(404)
    })

    it("shows a plain price, leaves out an unknown variant and refuses a bad query", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "gosterim-duz", 5, 100)
      const read = await display(
        `variant_id=${variantId}&variant_id=variant_unknown&currency_code=try`
      )
      expect(Object.keys(read.data.price_display)).toEqual([variantId])
      expect(read.data.price_display[variantId]).toMatchObject({
        current: "100.00",
        before: null,
        on_sale: false,
      })
      expect(read.headers["cache-control"]).toContain("max-age=60")

      // A draft's price stays inside, as an unknown variant's does
      const draft = await stockedProduct(getContainer(), shop, "gosterim-taslak", 5, 100)
      await updateProductsWorkflow(getContainer()).run({
        input: { selector: { id: draft.productId }, update: { status: "draft" } },
      })
      const hidden = await display(`variant_id=${draft.variantId}&currency_code=try`)
      expect(hidden.data.price_display).toEqual({})

      const many = Array.from({ length: 101 }, (_, index) => `variant_id=v${String(index)}`)
      for (const query of [`variant_id=${variantId}`, `${many.join("&")}&currency_code=try`]) {
        expect((await display(query)).status).toBe(400)
      }
    })
  },
})

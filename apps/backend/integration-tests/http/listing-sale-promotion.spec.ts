import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PRICE_HISTORY_MODULE } from "../../src/modules/price-history"
import type PriceHistoryModuleService from "../../src/modules/price-history/service"
import { SEO_REDIRECTS_MODULE } from "../../src/modules/seo-redirects"
import type SeoRedirectsModuleService from "../../src/modules/seo-redirects/service"
import { searchIndexMinute } from "../../src/workflows/search/upkeep"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { landingKit } from "../helpers/landings"
import type { LandingKit } from "../helpers/landings"
import { indexCatalogue } from "../helpers/search-index"

jest.setTimeout(240 * 1000)

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface Listing {
  product_ids: string[]
  count: number
  facets: { price: { min: number; max: number } | null }
}

const CUP = { malzeme: "seramik", renk: ["mavi"] }

// A percentage off the products named (`items`) or off every product (`order`), as the panel makes it
const percent = (value: number, productIds: string[] | null) => ({
  type: "percentage",
  target_type: productIds ? "items" : "order",
  allocation: "across",
  value,
  ...(productIds
    ? { target_rules: [{ attribute: "items.product.id", operator: "in", values: productIds }] }
    : {}),
})

/**
 * `/kampanyalar` with automatic promotions (adr/0023 Ek 2026-11-05): a
 * product whose price an automatic promotion every shopper gets brings
 * down is on sale, by the same price-before rule as its card; worked out
 * when the product is indexed, so a promotion on every product is still
 * one statement of the index, and the minute job notices a promotion that
 * changed.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
    })

    const listing = (type: string, id: string, query = "") =>
      settle(
        http.get<Listing & { message?: string }>(
          `/store/listings/products?${new URLSearchParams({
            type,
            id,
            region_id: kit.shop.regionId,
            currency_code: "try",
            query,
          }).toString()}`,
          { headers: kit.store.headers }
        )
      )
    // The sale listing, the catalogue indexed first unless the index's own upkeep is under test
    const sale = async (query = "", rebuild = true) => {
      if (rebuild) {
        await indexCatalogue(getContainer())
      }
      return listing("sale", "sale", query)
    }

    const promotion = async (body: Record<string, unknown>) => {
      const made = await kit.post<{ promotion: { id: string } }>("/admin/promotions", {
        type: "standard",
        is_tax_inclusive: true,
        status: "active",
        ...body,
      })
      expect({ status: made.status, body: made.data }).toMatchObject({ status: 200 })
    }

    async function variantOf(productId: string): Promise<string> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product_variant", fields: ["id"], filters: { product_id: productId } })
      return (data[0] as { id: string }).id
    }

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

    it("lists what an automatic promotion every shopper gets brings down, by the price-before rule", async () => {
      const promoted = await kit.product("kupa-oto", CUP)
      const raised = await kit.product("kupa-zam", CUP)
      const coded = await kit.product("kupa-kod", CUP)
      const raisedVariant = await variantOf(raised)
      await recorded(raisedVariant, 1)

      await promotion({
        code: "OTO30",
        is_automatic: true,
        application_method: percent(30, [promoted, raised]),
      })
      // A code's promotion and a cart minimum's stay in the cart: nothing on sale by them
      await promotion({
        code: "KOD20",
        is_automatic: false,
        application_method: percent(20, [coded]),
      })
      await promotion({
        code: "ESIK10",
        is_automatic: true,
        rules: [{ attribute: "item_total", operator: "gte", values: ["2000"] }],
        application_method: percent(10, null),
      })
      // Raised after the promotion began: 140 is no discount on the 70 it sold at in the last 10 days
      await updateProductVariantsWorkflow(getContainer()).run({
        input: {
          product_variants: [
            { id: raisedVariant, prices: [{ currency_code: "try", amount: 200 }] },
          ],
        },
      })
      await recorded(raisedVariant, 2)

      const all = await sale()
      expect(all.status).toBe(200)
      expect(all.data.product_ids).toEqual([promoted])
      expect(all.data.count).toBe(1)
      // The price the card shows (100 less 30%) is what the listing filters and sorts by
      expect(all.data.facets.price).toMatchObject({ min: 70, max: 70 })
      expect((await sale("fiyat=60-75")).data.product_ids).toEqual([promoted])
      expect((await sale("fiyat=90-110")).data.count).toBe(0)

      // A list's resolve answers are forgotten here, as their 30 seconds would be
      await getContainer()
        .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
        .invalidateResolutions()
      const page = await kit.resolve("/kampanyalar")
      expect(page).toMatchObject({ type: "entity", entity_type: "sale" })
      expect(page.seo?.robots).toBe("index,follow")
    })

    it("lists the whole catalogue from the index when a promotion covers every product", async () => {
      await promotion({
        code: "HEPSI10",
        is_automatic: true,
        application_method: percent(10, null),
      })
      const onSale = await sale()
      const catalogue = await listing("all", "all")
      expect(onSale.status).toBe(200)
      expect(onSale.data.count).toBeGreaterThanOrEqual(4)
      expect(onSale.data.count).toBe(catalogue.data.count)
      expect(onSale.data.product_ids).toEqual(catalogue.data.product_ids)
    })

    it("notices a promotion within the minute, with no rebuild", async () => {
      const promoted = await kit.product("kupa-dakika", CUP)
      await indexCatalogue(getContainer())
      // The promotions as they are, noted
      await searchIndexMinute(getContainer())
      expect((await sale("", false)).data.product_ids).toEqual([])

      await promotion({
        code: "DAKIKA25",
        is_automatic: true,
        application_method: percent(25, [promoted]),
      })
      await searchIndexMinute(getContainer())
      const listed = await sale("", false)
      expect(listed.data.product_ids).toEqual([promoted])
      expect(listed.data.facets.price).toMatchObject({ min: 75, max: 75 })
      // Nothing changed since: the next minute marks nothing
      expect(await searchIndexMinute(getContainer())).toBe(0)
    })
  },
})

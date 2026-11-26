import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { landingKit } from "../helpers/landings"
import type { LandingKit } from "../helpers/landings"
import { indexCatalogue } from "../helpers/search-index"
import { stockedProduct } from "../helpers/stock"
import { createTestProduct } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Answer {
  product_ids: string[]
  count: number
  message?: string
}

/**
 * T1: "Stokta olmayan ürünler: göster / listelerde gizle". Shown by
 * default; hidden, a sold-out product leaves listings, search and the
 * categories' counts, while an untracked product always counts as in
 * stock and the sold-out product's own page still answers.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit
    let soldOut: string
    let untracked: string

    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    const get = <T>(path: string, params: Record<string, string>) =>
      settle(
        http.get<T>(`${path}?${new URLSearchParams(params).toString()}`, {
          headers: kit.store.headers,
        })
      )
    const category = () =>
      get<Answer>("/store/listings/products", {
        type: "product_category",
        id: kit.categoryId,
        region_id: kit.shop.regionId,
        currency_code: "try",
        query: "",
      })
    const search = () =>
      get<Answer>("/store/listings/products", {
        type: "search",
        q: "kupa",
        region_id: kit.shop.regionId,
        currency_code: "try",
        query: "",
      })
    const counts = async () =>
      (await get<{ counts: Record<string, number> }>("/store/category-counts", {})).data.counts[
        kit.categoryId
      ]

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
      // Sold out: its stock tracked, none on the shelf
      soldOut = (await stockedProduct(getContainer(), kit.shop, "kupa-tukendi", 0)).productId
      // Its stock not counted: always for sale (the platform's rule)
      const variantId = await createTestProduct(getContainer(), kit.shop.salesChannelId, {
        handle: "kupa-sayilmayan",
        price: 100,
      })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product_variant", fields: ["product_id"], filters: { id: variantId } })
      untracked = (data[0] as { product_id: string }).product_id
      for (const id of [soldOut, untracked]) {
        await kit.post(`/admin/products/${id}`, { categories: [{ id: kit.categoryId }] })
      }
      await indexCatalogue(getContainer())
    })

    afterEach(async () => {
      // The settings cache outlives the database reset between tests
      await settings().saveSection("inventory", { out_of_stock_listing: "show" }, null)
    })

    it("lists a sold-out product by default, as before", async () => {
      const listed = await category()
      expect(listed.status).toBe(200)
      expect(listed.data.product_ids).toEqual(expect.arrayContaining([soldOut, untracked]))
      expect((await search()).data.product_ids).toContain(soldOut)
    })

    it("hides sold-out products from listings, search and counts, never an untracked one", async () => {
      const before = await counts()
      const saved = await kit.post("/admin/platform-settings/inventory", {
        out_of_stock_listing: "hide",
      })
      expect(saved.status).toBe(200)

      const listed = await category()
      expect(listed.status).toBe(200)
      expect(listed.data.product_ids).not.toContain(soldOut)
      expect(listed.data.product_ids).toContain(untracked)
      expect((await search()).data.product_ids).not.toContain(soldOut)
      expect(await counts()).toBe((before ?? 0) - 1)

      // Its page still answers by its address (SEO: no 404, availability OutOfStock)
      const page = await get<{ products: { id: string }[] }>("/store/products", {
        handle: "kupa-tukendi",
        region_id: kit.shop.regionId,
        fields: "id",
      })
      expect(page.data.products.map((product) => product.id)).toEqual([soldOut])
    })

    it("refuses a value it does not know", async () => {
      const refused = await kit.post("/admin/platform-settings/inventory", {
        out_of_stock_listing: "sona-at",
      })
      expect(refused.status).toBe(400)
    })
  },
})

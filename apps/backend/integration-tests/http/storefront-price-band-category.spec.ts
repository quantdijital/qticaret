import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { indexCatalogue } from "../helpers/search-index"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface ShownBand {
  label: string
  category_id?: string
  min: number | null
  max: number | null
  product_ids: string[]
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const document = (home: Record<string, unknown>[]) => ({
  document: { header: [], home, footer: [], product: [], category: [] },
})

/**
 * A price band's own category (adr/0049, dated line 2026-11-15 on the note
 * "Katalog ana sayfası"): saved only with a category the shop has, a band
 * whose category is hidden left out of the storefront's strip (its
 * products never named), a category band's products picked from the
 * category's shown subtree, by price when the band has a bound.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves bands with a category and reads them with the category's products, a hidden one left out", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const shop = await stockShop(container)
      const asOwner = { headers: owner.headers }
      const category = async (name: string, more: Record<string, unknown> = {}) =>
        (
          await settle(
            http.post<{ product_category: { id: string } }>(
              "/admin/product-categories",
              { name, is_active: true, ...more },
              asOwner
            )
          )
        ).data.product_category.id
      const camp = await category("Kamp")
      const axes = await category("Baltalar", { parent_category_id: camp })
      const hidden = await category("Gizli seri", { is_active: false })
      const knife = await stockedProduct(container, shop, "kamp-cakisi", 5, 300)
      const axe = await stockedProduct(container, shop, "kamp-baltasi", 5, 1500)
      const secret = await stockedProduct(container, shop, "gizli-seri-bicak", 5, 5000)
      const plain = await stockedProduct(container, shop, "anahtarlik", 5, 100)
      const file = (productId: string, categoryId: string) =>
        updateProductsWorkflow(container).run({
          input: { selector: { id: productId }, update: { category_ids: [categoryId] } },
        })
      await file(knife.productId, camp)
      await file(axe.productId, axes)
      await file(secret.productId, hidden)
      await indexCatalogue(container)

      const strip = (bands: Record<string, unknown>[]) => ({
        id: "fiyatbantlari",
        type: "price_bands",
        ...ALWAYS,
        title: null,
        bands,
        thumbs: 4,
      })
      const save = (bands: Record<string, unknown>[]) =>
        settle(
          http.post<{ message?: string }>(
            "/admin/storefront-layout",
            document([strip(bands)]),
            asOwner
          )
        )

      const unknown = await save([
        { label: "₺200'e kadar", max: 200 },
        { label: "Yok", max: null, category_id: "pcat_yok" },
      ])
      expect([unknown.status, unknown.data.message]).toEqual([
        400,
        "storefront_layout.target_unknown",
      ])
      const saved = await save([
        { label: "₺200'e kadar", max: 200 },
        { label: "Kamp, ₺1.000'e kadar", max: 1000, category_id: camp },
        { label: "Kamp", max: null, category_id: camp },
        { label: "Gizli", max: null, category_id: hidden },
      ])
      // A hidden category exists: saved, as a rail's is
      expect(saved.status).toBe(200)
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)

      const live = await settle(
        http.get<{ layout: { home: { bands?: ShownBand[] }[] } }>("/store/storefront-layout", {
          headers: store.headers,
        })
      )
      const bands = live.data.layout.home[0]?.bands ?? []

      expect(bands.map((band) => [band.label, band.category_id, band.min, band.max])).toEqual([
        ["₺200'e kadar", undefined, null, 200],
        ["Kamp, ₺1.000'e kadar", camp, null, 1000],
        ["Kamp", camp, null, null],
      ])
      expect(bands[0]?.product_ids).toContain(plain.productId)
      // The category's products up to its bound, then (the knife shown) its subcategory's axe
      expect(bands[1]?.product_ids).toEqual([knife.productId])
      expect(bands[2]?.product_ids).toEqual([axe.productId])
      // The hidden category is named nowhere, its product not under a band of its own
      expect(JSON.stringify(live.data.layout)).not.toContain(hidden)
      expect(bands.slice(1).flatMap((band) => band.product_ids)).not.toContain(secret.productId)
    })
  },
})

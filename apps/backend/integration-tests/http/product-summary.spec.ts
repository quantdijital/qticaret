import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { CATALOG_ENTITY_TYPES } from "../../src/workflows/catalog/entity-paths"
import { catalogItems } from "../../src/workflows/marketing/feed-catalog"
import { seoPayloadFor } from "../../src/workflows/seo/payload"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Catalog {
  summary: string[]
  message?: string
}

const LINES = ["N690 çelik, 58-59 HRC", "Geyik boynuzu sap", "Sırttan kilitli", "2 yıl garanti"]
const SENTENCES = "N690 çelik, 58-59 HRC. Geyik boynuzu sap. Sırttan kilitli. 2 yıl garanti."

/** adr/0055 Ek 2026-11-05: a product's short description, its lines, and where they stand in. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    let store: Storefront

    const save = (id: string, body: unknown) =>
      settle(http.post<Catalog>(`/admin/products/${id}/catalog`, body, { headers: admin.headers }))
    const catalogOf = async (id: string) =>
      (await http.get<Catalog>(`/admin/products/${id}/catalog`, { headers: admin.headers })).data

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      shop = await stockShop(container)
      store = await createStorefront(container)
    })

    it("saves up to five tidy lines, refuses more, and clears them", async () => {
      const { productId } = await stockedProduct(getContainer(), shop, "caki", 3)
      expect((await catalogOf(productId)).summary).toEqual([])

      const saved = await save(productId, {
        summary: ["  N690 çelik,  58-59 HRC ", "", ...LINES.slice(1)],
      })
      expect([saved.status, saved.data.summary]).toEqual([200, LINES])
      expect((await catalogOf(productId)).summary).toEqual(LINES)

      const refusals = await Promise.all([
        save(productId, { summary: ["a", "b", "c", "d", "e", "f"] }),
        save(productId, { summary: ["x".repeat(91)] }),
        save(productId, { summary: ["gizli‮metin"] }),
        save(productId, { summary: "tek satır" }),
      ])
      expect(refusals.map((refused) => [refused.status, refused.data.message])).toEqual([
        [400, "catalog.summary_too_many"],
        [400, "catalog.summary_too_long"],
        [400, "catalog.summary_invalid"],
        [400, expect.any(String)],
      ])
      // A refused save changed nothing
      expect((await catalogOf(productId)).summary).toEqual(LINES)

      // The Store API gives the lines on the product's own answer
      const own = await settle(
        http.get<{ product: { product_extension?: { summary?: string[] | null } } }>(
          `/store/products/${productId}?fields=id,+product_extension.summary`,
          { headers: store.headers }
        )
      )
      expect([own.status, own.data.product.product_extension?.summary]).toEqual([200, LINES])

      expect((await save(productId, { summary: [] })).data.summary).toEqual([])
      await save(productId, { summary: LINES })
      expect((await save(productId, { summary: null })).data.summary).toEqual([])
    })

    it("stands in for the missing texts in the meta description, JSON-LD and feeds", async () => {
      const container = getContainer()
      // Structured data needs the shop's own address
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const { productId } = await stockedProduct(container, shop, "sapli-caki", 3, 1250)
      await save(productId, { summary: LINES })
      const seo = await seoPayloadFor(
        container,
        { entity_type: CATALOG_ENTITY_TYPES.product, entity_id: productId },
        "/urun/sapli-caki"
      )
      // The default template: "{kısa_açıklama}. {fiyat_cümlesi} {kargo_cümlesi}"
      expect(seo?.description.startsWith(SENTENCES)).toBe(true)
      expect(seo?.openGraph.description).toBe(seo?.description)
      const product = seo?.jsonLd.find((block) => block["@type"] === "Product")
      expect(product?.["description"]).toBe(SENTENCES)

      const items = await catalogItems(container, "https://magaza.example.com")
      expect(items.find((item) => item.link.endsWith("/sapli-caki"))?.description).toBe(SENTENCES)
    })
  },
})

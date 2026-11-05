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
  summary_doc: unknown
  message?: string
}

const text = (value: string, marks?: unknown[]) => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
})

const DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        text("Yıkanmış "),
        text("keten", [{ type: "bold" }]),
        text(", rahat kesim"),
        { type: "hardBreak" },
        text("bakım", [{ type: "link", attrs: { href: "/bakim" } }]),
        text(" kolay."),
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [text("Sedef düğme")] }] },
      ],
    },
  ],
}
const HTML =
  '<p>Yıkanmış <strong>keten</strong>, rahat kesim<br><a href="/bakim">bakım</a> kolay.</p>' +
  "<ul><li><p>Sedef düğme</p></li></ul>"
const SENTENCES = "Yıkanmış keten, rahat kesim. bakım kolay. Sedef düğme."

const doc = (...content: unknown[]) => ({ type: "doc", content })

/** adr/0055 Ek 2026-11-06: a product's short description as written, and where it stands in. */
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
    const storeTexts = (id: string) =>
      settle(
        http.get<{ html: string | null; summary_html: string | null }>(
          `/store/products/${id}/description`,
          { headers: store.headers }
        )
      )

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      shop = await stockShop(container)
      store = await createStorefront(container)
    })

    it("saves a document as written, refuses what the short slot does not take, and clears it", async () => {
      const { productId } = await stockedProduct(getContainer(), shop, "ozetli-gomlek", 3)
      expect((await catalogOf(productId)).summary_doc).toBeNull()
      expect((await storeTexts(productId)).data).toEqual({ html: null, summary_html: null })

      const saved = await save(productId, { summary_doc: DOC })
      expect([saved.status, saved.data.summary_doc]).toEqual([200, DOC])
      expect((await catalogOf(productId)).summary_doc).toEqual(DOC)
      // The storefront gets it rendered as the long description is
      expect((await storeTexts(productId)).data).toEqual({ html: null, summary_html: HTML })

      const paragraph = (value: string, marks?: unknown[]) => ({
        type: "paragraph",
        content: [text(value, marks)],
      })
      const refusals = await Promise.all([
        save(productId, {
          summary_doc: doc({ type: "heading", attrs: { level: 2 }, content: [text("Başlık")] }),
        }),
        save(productId, {
          summary_doc: doc({
            type: "table",
            content: [
              { type: "tableRow", content: [{ type: "tableCell", content: [paragraph("a")] }] },
            ],
          }),
        }),
        save(productId, {
          summary_doc: doc(paragraph("eski", [{ type: "link", attrs: { href: "http://a.com" } }])),
        }),
        save(productId, { summary_doc: doc(paragraph("x".repeat(1_501))) }),
        save(productId, { summary_doc: ["tek satır"] }),
      ])
      expect(refusals.map((refused) => [refused.status, refused.data.message])).toEqual([
        [400, "catalog.summary_blocks"],
        [400, "catalog.summary_blocks"],
        [400, "catalog.summary_link"],
        [400, "catalog.summary_too_long"],
        [400, expect.any(String)],
      ])
      // A refused save changed nothing
      expect((await catalogOf(productId)).summary_doc).toEqual(DOC)

      // The Store API gives the document on the product's own answer
      const own = await settle(
        http.get<{ product: { product_extension?: { summary_doc?: unknown } } }>(
          `/store/products/${productId}?fields=id,+product_extension.summary_doc`,
          { headers: store.headers }
        )
      )
      expect([own.status, own.data.product.product_extension?.summary_doc]).toEqual([200, DOC])

      // An editor's empty text clears it, as null does
      const empty = await save(productId, { summary_doc: doc({ type: "paragraph" }) })
      expect([empty.status, empty.data.summary_doc]).toEqual([200, null])
      await save(productId, { summary_doc: DOC })
      expect((await save(productId, { summary_doc: null })).data.summary_doc).toBeNull()
      expect((await storeTexts(productId)).data.summary_html).toBeNull()
    })

    it("stands in for the missing texts in the meta description, JSON-LD and feeds", async () => {
      const container = getContainer()
      // Structured data needs the shop's own address
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const { productId } = await stockedProduct(container, shop, "sapli-gomlek", 3, 1250)
      await save(productId, { summary_doc: DOC })
      const seo = await seoPayloadFor(
        container,
        { entity_type: CATALOG_ENTITY_TYPES.product, entity_id: productId },
        "/urun/sapli-gomlek"
      )
      // The default template: "{kısa_açıklama}. {fiyat_cümlesi} {kargo_cümlesi}"
      expect(seo?.description.startsWith(`${SENTENCES.slice(0, -1)}.`)).toBe(true)
      expect(seo?.openGraph.description).toBe(seo?.description)
      const product = seo?.jsonLd.find((block) => block["@type"] === "Product")
      expect(product?.["description"]).toBe(SENTENCES)

      const items = await catalogItems(container, "https://magaza.example.com")
      expect(items.find((item) => item.link.endsWith("/sapli-gomlek"))?.description).toBe(SENTENCES)
    })
  },
})

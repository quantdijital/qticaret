import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { importProductWorkflow } from "../../src/workflows/catalog/import/import-product"
import type { ImportPlan } from "../../src/workflows/catalog/import/plan"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

const text = (value: string, marks?: unknown[]) => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
})
const cell = (type: string, value: string) => ({
  type,
  content: [{ type: "paragraph", content: [text(value)] }],
})

// Headings, a list, a quote, a table, bold and a link: what a WordPress body brings
const DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [text("Özellikler")] },
    {
      type: "paragraph",
      content: [
        text("Ağır "),
        text("döküm", [{ type: "bold" }]),
        text(" gövde, "),
        text("bakım", [{ type: "link", attrs: { href: "/bakim" } }]),
        text("."),
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [text("Fırına girer")] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [text("24 cm")] }] },
      ],
    },
    { type: "blockquote", content: [{ type: "paragraph", content: [text("Ömürlük.")] }] },
    {
      type: "table",
      content: [
        { type: "tableRow", content: [cell("tableHeader", "Ölçü"), cell("tableCell", "24 cm")] },
      ],
    },
  ],
}
const DERIVED =
  "Özellikler\n\nAğır döküm gövde, bakım.\n\nFırına girer\n24 cm\n\nÖmürlük.\n\nÖlçü · 24 cm"

interface Catalog {
  description_doc: unknown
  message?: string
}

/** adr/0055: a product's long description as a content document, its plain text the server's. */
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
    const descriptionOf = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product", fields: ["description"], filters: { id } })
      return (data[0] as { description: string | null }).description
    }
    const storeDescription = (id: string) =>
      settle(
        http.get<{ html: string | null; message?: string }>(`/store/products/${id}/description`, {
          headers: store.headers,
        })
      )

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      shop = await stockShop(container)
      store = await createStorefront(container)
    })

    it("saves a document, writes its plain text, and gives the storefront its HTML", async () => {
      const { productId } = await stockedProduct(getContainer(), shop, "dokum-tava", 3)
      // Plain text only: the storefront shows `description`
      expect((await storeDescription(productId)).data).toEqual({
        html: null,
        summary_html: null,
        images: [],
      })

      const saved = await save(productId, { description_doc: DOC })
      expect(saved.status).toBe(200)
      expect(saved.data.description_doc).toEqual(DOC)
      expect(await descriptionOf(productId)).toBe(DERIVED)
      expect((await catalogOf(productId)).description_doc).toEqual(DOC)

      const read = await storeDescription(productId)
      expect(read.status).toBe(200)
      expect(read.data.html).toBe(
        "<h2>Özellikler</h2>" +
          '<p>Ağır <strong>döküm</strong> gövde, <a href="/bakim">bakım</a>.</p>' +
          "<ul><li><p>Fırına girer</p></li><li><p>24 cm</p></li></ul>" +
          "<blockquote><p>Ömürlük.</p></blockquote>" +
          "<table><tbody><tr><th><p>Ölçü</p></th><td><p>24 cm</p></td></tr></tbody></table>"
      )
      // The Store API answers the document on the product itself, never through a line
      const own = await settle(
        http.get<{ product: { product_extension?: { description_doc?: unknown } } }>(
          `/store/products/${productId}?fields=id,+product_extension.description_doc`,
          { headers: store.headers }
        )
      )
      expect(own.status).toBe(200)
      expect(own.data.product.product_extension?.description_doc).toEqual(DOC)

      // Null drops the document and keeps the text; an empty one clears both
      expect((await save(productId, { description_doc: null })).data.description_doc).toBeNull()
      expect(await descriptionOf(productId)).toBe(DERIVED)
      expect((await storeDescription(productId)).data.html).toBeNull()
      await save(productId, { description_doc: DOC })
      const emptied = await save(productId, {
        description_doc: { type: "doc", content: [{ type: "paragraph" }] },
      })
      expect(emptied.data.description_doc).toBeNull()
      expect(await descriptionOf(productId)).toBe("")
    })

    it("refuses pictures, cards and documents out of shape, changing nothing", async () => {
      const { productId } = await stockedProduct(getContainer(), shop, "kasik", 3)
      const before = await descriptionOf(productId)
      const picture = await save(productId, {
        description_doc: {
          type: "doc",
          content: [{ type: "image", attrs: { src: "https://cdn.example.com/a.jpg" } }],
        },
      })
      expect([picture.status, picture.data.message]).toEqual([400, "catalog.description_blocks"])
      const script = await save(productId, {
        description_doc: { type: "doc", content: [{ type: "codeBlock", content: [text("x")] }] },
      })
      expect([script.status, script.data.message]).toEqual([400, "content.body_invalid"])
      const unsafe = await save(productId, {
        description_doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [text("tık", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])],
            },
          ],
        },
      })
      expect(unsafe.status).toBe(400)
      expect(await descriptionOf(productId)).toBe(before)
      expect((await catalogOf(productId)).description_doc).toBeNull()
    })

    it("answers an unpublished product's description as unknown", async () => {
      const { productId } = await stockedProduct(getContainer(), shop, "taslak", 3)
      await save(productId, { description_doc: DOC })
      await getContainer().resolve(Modules.PRODUCT).updateProducts(productId, { status: "draft" })
      expect((await storeDescription(productId)).status).toBe(404)
    })

    it("lets a sheet's new plain description replace the document, and an unchanged row keep it", async () => {
      const { productId } = await stockedProduct(getContainer(), shop, "sayfadan", 3)
      await save(productId, { description_doc: DOC })
      const plan = (product: Record<string, unknown>): ImportPlan => ({
        handle: "sayfadan",
        line: 2,
        productId,
        product,
        options: null,
        variantCreates: [],
        variantUpdates: [],
        stock: [],
        costs: [],
        seo: null,
        attributes: null,
      })
      // A row that changes something else leaves the document
      await importProductWorkflow(getContainer()).run({
        input: { plan: plan({ title: "Sayfadan" }), location_id: null },
      })
      expect((await catalogOf(productId)).description_doc).toEqual(DOC)

      await importProductWorkflow(getContainer()).run({
        input: { plan: plan({ description: "Yeni düz metin." }), location_id: null },
      })
      expect(await descriptionOf(productId)).toBe("Yeni düz metin.")
      expect((await catalogOf(productId)).description_doc).toBeNull()
    })
  },
})

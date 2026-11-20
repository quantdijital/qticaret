import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

/** A pasted text as the panel's editor sends it: a heading, a marked paragraph with a link, a list. */
const DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Şam çeliği" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Katmanlı", marks: [{ type: "bold" }] },
        { type: "text", text: " çelik; " },
        { type: "text", text: "bakım", marks: [{ type: "link", attrs: { href: "/bakim" } }] },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "El dövmesi" }] }],
        },
      ],
    },
  ],
}

/** What the server writes beside it: the meta description's fallback, search's, the advisor's. */
const TEXT = "Şam çeliği\n\nKatmanlı çelik; bakım\n\nEl dövmesi"

const HTML =
  '<h2>Şam çeliği</h2><p><strong>Katmanlı</strong> çelik; <a href="/bakim">bakım</a></p>' +
  "<ul><li><p>El dövmesi</p></li></ul>"

/** Pictures and cards are a page's, never a listing description's. */
const WITH_IMAGE = {
  type: "doc",
  content: [{ type: "image", attrs: { src: "https://cdn.example.com/a.jpg", alt: "" } }],
}
const WITH_CARD = {
  type: "doc",
  content: [{ type: "productCard", attrs: { id: "prod_01JC0000000000000000000000" } }],
}

/** adr/0075: category, brand and collection descriptions as content documents, shown at the foot. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const adminGet = <T>(url: string) =>
      settle(http.get<T & { message?: string }>(url, { headers: admin.headers }))
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))
    const audited = (resourceId: string, action: string) =>
      eventually(
        async () =>
          (
            await http.get<{ audit_entries: { action: string }[] }>(
              `/admin/audit-log?resource_id=${resourceId}&kind=mutation`,
              { headers: admin.headers }
            )
          ).data.audit_entries,
        (found) => found.some((entry) => entry.action === action)
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    it("saves a category's document, mirrors its text into Medusa's and renders it for the storefront", async () => {
      const created = await post<{ product_category: { id: string } }>(
        "/admin/product-categories",
        { name: "Mutfak Bıçakları", description: "Eski düz metin.", is_active: true }
      )
      const id = created.data.product_category.id
      const hidden = (
        await post<{ product_category: { id: string } }>("/admin/product-categories", {
          name: "Arşiv",
          is_active: false,
        })
      ).data.product_category.id
      interface Answer {
        description: { category_id: string; description: string; description_doc: unknown }
      }

      const legacy = await adminGet<Answer>(`/admin/category-descriptions/${id}`)
      const plainStore = await storeGet<{ description_html: string | null }>(
        `/store/category-descriptions/${id}`
      )
      const image = await post(`/admin/category-descriptions/${id}`, {
        description_doc: WITH_IMAGE,
      })
      const card = await post(`/admin/category-descriptions/${id}`, { description_doc: WITH_CARD })
      const plain = await post(`/admin/category-descriptions/${id}`, { description: "Düz" })
      const unknown = await post("/admin/category-descriptions/pcat_yok", { description_doc: DOC })
      const saved = await post<Answer>(`/admin/category-descriptions/${id}`, {
        description_doc: DOC,
      })
      const medusa = await adminGet<{ product_category: { description: string } }>(
        `/admin/product-categories/${id}?fields=description`
      )
      const shown = await storeGet<{ category_id: string; description_html: string | null }>(
        `/store/category-descriptions/${id}`
      )
      await post(`/admin/category-descriptions/${hidden}`, { description_doc: DOC })
      const hiddenShown = await storeGet(`/store/category-descriptions/${hidden}`)

      // A category with plain text only: the panel opens its paragraphs, the page shows them
      expect(legacy.data.description).toEqual({
        category_id: id,
        description: "Eski düz metin.",
        description_doc: null,
      })
      expect(plainStore.status).toBe(200)
      expect(plainStore.data.description_html).toBeNull()
      expect([image.status, card.status]).toEqual([400, 400])
      expect(image.data.message).toBe("catalog.listing_description_blocks")
      expect(card.data.message).toBe("catalog.listing_description_blocks")
      // The panel sends the document only
      expect(plain.status).toBe(400)
      expect(unknown.status).toBe(404)
      expect(saved.status).toBe(200)
      expect(saved.data.description).toEqual({
        category_id: id,
        description: TEXT,
        description_doc: DOC,
      })
      expect(medusa.data.product_category.description).toBe(TEXT)
      expect(shown.status).toBe(200)
      expect(shown.data).toEqual({ category_id: id, description_html: HTML })
      expect(shown.headers["cache-control"]).toContain("max-age=60")
      expect(hiddenShown.status).toBe(404)
      await audited(id, "POST /admin/category-descriptions/:category_id")

      // A document without text clears both; null drops the document and keeps the text
      await post(`/admin/category-descriptions/${id}`, { description_doc: DOC })
      const dropped = await post<Answer>(`/admin/category-descriptions/${id}`, {
        description_doc: null,
      })
      expect(dropped.data.description).toEqual({
        category_id: id,
        description: TEXT,
        description_doc: null,
      })
      const cleared = await post<Answer>(`/admin/category-descriptions/${id}`, {
        description_doc: { type: "doc", content: [] },
      })
      expect(cleared.data.description).toEqual({
        category_id: id,
        description: "",
        description_doc: null,
      })
    })

    it("saves a brand's document with its plain text, and shows it on the brand's answer", async () => {
      interface Brand {
        id: string
        description: string | null
        description_doc: unknown
      }
      const created = await post<{ brand: Brand }>("/admin/brands", {
        name: "Örnek Çelik",
        description_doc: DOC,
      })
      const id = created.data.brand.id
      const image = await post(`/admin/brands/${id}`, { description_doc: WITH_IMAGE })
      const both = await post(`/admin/brands/${id}`, { description: "Düz", description_doc: DOC })
      const read = await adminGet<{ brand: Brand }>(`/admin/brands/${id}`)
      const shown = await storeGet<{
        brand: { description: string | null; description_html: string | null }
      }>(`/store/brands/${id}`)

      expect(created.status).toBe(201)
      expect(created.data.brand).toMatchObject({ description: TEXT, description_doc: DOC })
      expect(image.status).toBe(400)
      expect(image.data.message).toBe("catalog.listing_description_blocks")
      expect(both.status).toBe(400)
      expect(both.data.message).toBe("catalog.description_one_of")
      expect(read.data.brand).toMatchObject({ description: TEXT, description_doc: DOC })
      expect(shown.data.brand).toMatchObject({ description: TEXT, description_html: HTML })
      await audited(id, "POST /admin/brands/:id")

      // A plain text written as an import does drops the document, so the two never differ
      const plain = await post<{ brand: Brand }>(`/admin/brands/${id}`, { description: "Düz." })
      const plainShown = await storeGet<{ brand: { description_html: string | null } }>(
        `/store/brands/${id}`
      )
      expect(plain.data.brand).toMatchObject({ description: "Düz.", description_doc: null })
      expect(plainShown.data.brand.description_html).toBeNull()

      // A document without text clears both
      const cleared = await post<{ brand: Brand }>(`/admin/brands/${id}`, {
        description_doc: { type: "doc", content: [{ type: "paragraph" }] },
      })
      expect(cleared.data.brand).toMatchObject({ description: null, description_doc: null })
    })

    it("saves a collection's document with its plain text, and shows it on its details", async () => {
      interface Collection {
        id: string
        description: string | null
        description_doc: unknown
      }
      const collection = (
        await post<{ collection: { id: string } }>("/admin/collections", { title: "Yaz Seçkisi" })
      ).data.collection
      const card = await post(`/admin/collections/${collection.id}/details`, {
        description_doc: WITH_CARD,
      })
      const both = await post(`/admin/collections/${collection.id}/details`, {
        description: "Düz",
        description_doc: DOC,
      })
      const saved = await post<{ collection: Collection }>(
        `/admin/collections/${collection.id}/details`,
        { description_doc: DOC }
      )
      const board = await adminGet<{ collection: Collection }>(
        `/admin/collection-board/${collection.id}`
      )
      const shown = await storeGet<{
        details: { description: string | null; description_html: string | null }
      }>(`/store/collections/${collection.id}/details`)

      expect(card.status).toBe(400)
      expect(card.data.message).toBe("catalog.listing_description_blocks")
      expect(both.status).toBe(400)
      expect(both.data.message).toBe("catalog.description_one_of")
      expect(saved.status).toBe(200)
      expect(saved.data.collection).toMatchObject({ description: TEXT, description_doc: DOC })
      expect(board.data.collection).toMatchObject({ description: TEXT, description_doc: DOC })
      expect(shown.data.details).toMatchObject({ description: TEXT, description_html: HTML })
      await audited(collection.id, "POST /admin/collections/:id/details")

      // Visibility alone leaves the text and its document as they are
      await post(`/admin/collections/${collection.id}/details`, { is_active: true })
      const kept = await storeGet<{ details: { description_html: string | null } }>(
        `/store/collections/${collection.id}/details`
      )
      expect(kept.data.details.description_html).toBe(HTML)

      // A plain text (an import) drops the document
      await post(`/admin/collections/${collection.id}/details`, { description: "Düz." })
      const plain = await storeGet<{
        details: { description: string | null; description_html: string | null }
      }>(`/store/collections/${collection.id}/details`)
      expect(plain.data.details).toMatchObject({ description: "Düz.", description_html: null })
    })
  },
})

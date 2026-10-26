import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Entry {
  id: string
  handle: string
  published_at: string | null
  revised_at: string | null
}

const text = (value: string) => ({ type: "text", text: value })
const doc = (...content: unknown[]) => ({ type: "doc", content })
const p = (value: string) => ({ type: "paragraph", content: [text(value)] })

/** F3.16: what a content save keeps, frees and refuses over time. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const save = (body: Record<string, unknown>, id?: string) =>
      settle(
        http.post<{ entry: Entry; message?: string }>(
          id ? `/admin/content/${id}` : "/admin/content",
          body,
          { headers: admin.headers }
        )
      )
    const resolve = async (path: string) =>
      (
        await http.get<{ type: string }>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    it("dates a text's first going live and its real changes only", async () => {
      const body = doc(p("Kargo üç iş gününde."), p("İade on dört gün."))
      const made = await save({ kind: "page", title: "Kargo", status: "published", body })
      const { id, published_at } = made.data.entry
      expect(published_at).not.toBeNull()

      // The same text sent again (as an import would) is no revision
      expect((await save({ body }, id)).data.entry.revised_at).toBeNull()
      const retitled = await save({ title: "Kargo ve iade" }, id)
      expect(retitled.data.entry.revised_at).not.toBeNull()

      await save({ status: "draft" }, id)
      const again = await save({ status: "published" }, id)
      expect(again.data.entry.published_at).toBe(published_at)
    })

    it("keeps a page editable when a product its card shows is deleted", async () => {
      const shop = await stockShop(getContainer())
      const { productId } = await stockedProduct(getContainer(), shop, "silinecek-kupa", 1)
      const made = await save({
        kind: "post",
        title: "Kupa listesi",
        status: "published",
        body: doc(p("Önerimiz:"), { type: "productCard", attrs: { id: productId } }),
      })
      await settle(http.delete(`/admin/products/${productId}`, admin))

      expect((await save({ title: "Kupa listemiz" }, made.data.entry.id)).status).toBe(200)
      const { data } = await settle(
        http.get<{ entry: { html: string } }>(`/store/content/${made.data.entry.id}`, {
          headers: store.headers,
        })
      )
      expect(data.entry.html).toBe("<p>Önerimiz:</p>")
    })

    it("frees the old path of a draft renamed as it goes live", async () => {
      const made = await save({ kind: "page", title: "Eski taslak" })
      await save({ status: "published", handle: "yeni-sayfa" }, made.data.entry.id)
      expect((await resolve("/eski-taslak")).type).toBe("not_found")
      expect((await save({ kind: "page", title: "Eski taslak" })).status).toBe(201)
    })

    it("keeps a post's SEO fields its own, not a page's", async () => {
      const post = await save({ kind: "post", title: "Yazı" })
      const wrong = await settle(
        http.put(`/admin/seo/page/${post.data.entry.id}`, { seo_title: "Başlık" }, admin)
      )
      expect(wrong.status).toBe(404)
    })

    it("lists live posts by their own summary, else their opening, with a reading time", async () => {
      const words = Array.from({ length: 450 }, (_, index) => `kelime${String(index)}`).join(" ")
      await save({ kind: "post", title: "Uzun yazı", status: "published", body: doc(p(words)) })
      await save({ kind: "post", title: "Taslak yazı", body: doc(p("gizli")) })
      const { data } = await settle(
        http.get<{ entries: { title: string; excerpt: string; reading_minutes: number }[] }>(
          "/store/content?kind=post",
          { headers: store.headers }
        )
      )
      expect(data.entries.map((entry) => entry.title)).toEqual(["Uzun yazı"])
      expect(data.entries[0]?.excerpt.startsWith("kelime0 kelime1")).toBe(true)
      expect(data.entries[0]?.reading_minutes).toBe(2)
    })
  },
})

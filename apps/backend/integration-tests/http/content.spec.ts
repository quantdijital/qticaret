import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Entry {
  id: string
  kind: "page" | "post"
  handle: string
  path: string
  status: string
  published_at: string | null
  revised_at: string | null
}

interface Answer {
  type: string
  status?: number
  location?: string
  entity_type?: string
  entity_id?: string
  seo?: {
    title: string
    description: string
    openGraph: { type: string }
    breadcrumbs: { name: string }[]
    jsonLd: Record<string, unknown>[]
  } | null
}

const text = (value: string, marks?: unknown[]) => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
})
const p = (...content: unknown[]) => ({ type: "paragraph", content })
const doc = (...content: unknown[]) => ({ type: "doc", content })
const COVER = "https://cdn.example.com/content/kapak.webp"
// The versions the media pipeline made of the cover, as a product image's
const COVER_DERIVATIVES = {
  srcset: {
    webp: [{ width: 640, url: "https://cdn.example.com/content/kapak-640.webp" }],
    avif: [{ width: 640, url: "https://cdn.example.com/content/kapak-640.avif" }],
  },
  og: { url: "https://cdn.example.com/content/kapak-og.jpg", width: 1200, height: 630 },
}

/** F3.16 (adr/0019): content pages and blog posts, their paths, SEO and Store API. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const save = (body: Record<string, unknown>, id?: string) =>
      post<{ entry: Entry }>(id ? `/admin/content/${id}` : "/admin/content", body)
    const resolve = async (path: string) =>
      (
        await http.get<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      store = await createStorefront(container)
      await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        // As an upload leaves it: a file behind the address
        .createMediaAssets([
          {
            url: COVER,
            file_id: "content-test-cover",
            width: 1600,
            height: 900,
            derivatives: COVER_DERIVATIVES,
          },
        ])
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    it("keeps a page out of sight while a draft, and gives it its path and SEO when live", async () => {
      const made = await save({
        kind: "page",
        title: "Hakkımızda",
        body: doc(p(text("Biz kimiz."))),
      })
      expect(made.status).toBe(201)
      expect(made.data.entry).toMatchObject({
        handle: "hakkimizda",
        path: "/hakkimizda",
        status: "draft",
      })
      const id = made.data.entry.id
      expect((await resolve("/hakkimizda")).type).toBe("not_found")
      expect((await storeGet(`/store/content/${id}`)).status).toBe(404)

      const live = await save({ status: "published" }, id)
      expect(live.data.entry.published_at).not.toBeNull()
      const answer = await resolve("/hakkimizda")
      expect(answer).toMatchObject({ type: "entity", entity_type: "page", entity_id: id })
      expect(answer.seo?.title.startsWith("Hakkımızda |")).toBe(true)
      expect(answer.seo?.description).toBe("Biz kimiz.")
      expect(answer.seo?.jsonLd[0]).toMatchObject({ "@type": "WebPage", name: "Hakkımızda" })
      // No cover: nothing to size
      const read = await storeGet<{ entry: Record<string, unknown> }>(`/store/content/${id}`)
      expect(read.data.entry).toMatchObject({
        image_url: null,
        image_width: null,
        image_height: null,
        image_derivatives: null,
      })
    })

    it("shows a draft through its signed preview link only, for a day", async () => {
      const made = await save({ kind: "page", title: "Taslak", body: doc(p(text("Henüz değil."))) })
      const id = made.data.entry.id
      const link = await post<{ url: string; path: string; expires_at: string }>(
        `/admin/content/${id}/preview`,
        {}
      )
      const token = link.data.path.split("/").pop() ?? ""
      const opened = await storeGet<{ entry: { id: string; html: string } }>(
        `/store/content/preview/${token}`
      )
      const forged = await storeGet(`/store/content/preview/${token.slice(0, -2)}xx`)
      const unknown = await post(`/admin/content/cnt_0000000000/preview`, {})

      expect(link.status).toBe(200)
      expect(link.data.url).toBe(`https://magaza.example.com${link.data.path}`)
      expect(link.data.path.startsWith("/onizleme/")).toBe(true)
      expect(new Date(link.data.expires_at).getTime()).toBeGreaterThan(Date.now())
      expect(opened.status).toBe(200)
      expect(opened.data.entry).toMatchObject({ id })
      expect(opened.data.entry.html).toContain("Henüz değil.")
      expect(opened.headers["cache-control"]).toBe("no-store")
      expect(forged.status).toBe(404)
      expect(unknown.status).toBe(404)
      // The draft itself stays out of sight
      expect((await storeGet(`/store/content/${id}`)).status).toBe(404)
      // Saved again: the link made before shows nothing written since
      await save({ title: "Taslak, ikinci hâli" }, id)
      expect((await storeGet(`/store/content/preview/${token}`)).status).toBe(404)
    })

    it("renders a post with its cards and cover, and makes it an article", async () => {
      const shop = await stockShop(getContainer())
      const { productId } = await stockedProduct(getContainer(), shop, "kupa-karti", 3)
      const made = await save({
        kind: "post",
        title: "Kupa nasıl seçilir?",
        status: "published",
        author_name: "Ayşe Yılmaz",
        image_url: COVER,
        image_alt: "Kupalar",
        body: doc(
          { type: "heading", attrs: { level: 2 }, content: [text("Seramik mi?")] },
          p(text("Bkz. "), text("kategori", [{ type: "link", attrs: { href: "/kategori/kupa" } }])),
          { type: "image", attrs: { src: COVER, alt: "Kupa" } },
          { type: "productCard", attrs: { id: productId } }
        ),
      })
      expect(made.status).toBe(201)
      const { id, path } = made.data.entry
      expect(path).toBe("/blog/kupa-nasil-secilir")

      const { data } = await storeGet<{ entry: { html: string; reading_minutes: number } }>(
        `/store/content/${id}`
      )
      expect(data.entry.html).toContain("<h2>Seramik mi?</h2>")
      expect(data.entry.html).toContain(`<img src="${COVER}" alt="Kupa"`)
      expect(data.entry.html).toContain('<a href="/urun/kupa-karti">kupa-karti</a>')
      const list = await storeGet<{ entries: { id: string }[] }>("/store/content?kind=post")
      expect(list.data.entries.map((entry) => entry.id)).toEqual([id])
      // The cover's size and versions from the media library: `width`/`height` and a `srcset`
      const cover = {
        image_url: COVER,
        image_width: 1600,
        image_height: 900,
        image_derivatives: COVER_DERIVATIVES,
      }
      expect(data.entry).toMatchObject(cover)
      expect(list.data.entries[0]).toMatchObject(cover)

      const answer = await resolve(path)
      expect(answer.seo?.openGraph.type).toBe("article")
      expect(answer.seo?.breadcrumbs.map((crumb) => crumb.name)).toEqual([
        "Blog",
        "Kupa nasıl seçilir?",
      ])
      expect(answer.seo?.jsonLd[0]).toMatchObject({
        "@type": "BlogPosting",
        author: { "@type": "Person", name: "Ayşe Yılmaz" },
        image: [COVER],
      })

      // The advisor judged it by the content rules
      const assessed = await http.get<{ assessment: { issues: { ruleId: string }[] } | null }>(
        `/admin/seo/assessments/post/${id}`,
        admin
      )
      expect(assessed.data.assessment?.issues.map((issue) => issue.ruleId)).toContain("A-LEN-01")
    })

    it.each([
      [
        "an image not in the media library",
        { body: doc({ type: "image", attrs: { src: "https://evil.example/x.png" } }) },
        "content.image_unknown",
      ],
      [
        "a cover not in the media library",
        { image_url: "https://evil.example/x.png" },
        "content.image_unknown",
      ],
      [
        "a card for no product",
        { body: doc({ type: "productCard", attrs: { id: "prod_01NOTAPRODUCT0000000000000" } }) },
        "content.card_unknown",
      ],
      ["a page taking a reserved path", { handle: "blog" }, "seo.path_reserved"],
    ])("refuses %s", async (_label, fields, message) => {
      const refused = await save({ kind: "page", title: "Deneme", ...fields })
      expect([refused.status, refused.data.message]).toEqual([400, message])
    })

    it("refuses markup that is not on the allowlist", async () => {
      const refused = await save({
        kind: "page",
        title: "Deneme",
        body: doc({ type: "html", html: "<script>alert(1)</script>" }),
      })
      expect(refused.status).toBe(400)
    })

    it("redirects a live post's old path, and answers 410 once it is gone", async () => {
      const made = await save({ kind: "post", title: "Eski ad", status: "published" })
      const { id } = made.data.entry
      await save({ handle: "yeni-ad" }, id)
      expect(await resolve("/blog/eski-ad")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/blog/yeni-ad",
      })
      expect((await settle(http.delete(`/admin/content/${id}`, admin))).status).toBe(200)
      expect(await resolve("/blog/yeni-ad")).toMatchObject({ type: "gone" })
    })

    it("frees a draft's path when it is deleted, and holds a handle once per kind", async () => {
      const draft = await save({ kind: "page", title: "Taslak" })
      const twice = await save({ kind: "page", title: "Taslak" })
      expect([twice.status, twice.data.message]).toEqual([400, "seo.path_taken"])
      await settle(http.delete(`/admin/content/${draft.data.entry.id}`, admin))
      expect((await save({ kind: "page", title: "Taslak" })).status).toBe(201)
    })

    it("uses the page's own SEO title", async () => {
      const made = await save({ kind: "page", title: "Kargo", status: "published" })
      const own = await settle(
        http.put(
          `/admin/seo/page/${made.data.entry.id}`,
          { seo_title: "Kargo ve teslimat koşulları" },
          admin
        )
      )
      expect(own.status).toBe(200)
      expect((await resolve("/kargo")).seo?.title).toBe("Kargo ve teslimat koşulları")
    })
  },
})

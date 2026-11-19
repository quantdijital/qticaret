import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { adminOrigin, sessionCookie } from "../helpers/staff-account"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface PageLayout {
  page_id: string
  sections: Section[]
}

interface AdminAnswer {
  layout: { draft: { pages: PageLayout[] } }
  dropped_pages?: number
  message?: string
}

interface PageAnswer {
  page: PageLayout | null
  entry?: { id: string; title: string; html: string }
  edition?: string
}

const text = (value: string) => ({ type: "text", text: value })
const doc = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [text(value)] }],
})
const help = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "help",
  title: "Hangi bıçak size uygun?",
  text: "Çelik, sap ya da bakım konusunda sorunuz varsa yazın.",
  ...more,
})

/**
 * adr/0073 §1, §6: content pages' own sections in the theme editor's
 * design. Saved, published and restored with it; a deleted page's layout
 * left out on the next write; read per page: the live read and the signed
 * design link show a live page only, the editor's live session a draft
 * page too, with the page itself.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves, publishes and reads a page's own sections; a deleted page's go with it", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const content = async (body: Record<string, unknown>) =>
        (await settle(http.post<{ entry: { id: string } }>("/admin/content", body, asOwner))).data
          .entry.id
      const about = await content({
        kind: "page",
        title: "Hakkımızda",
        body: doc("Atölyemiz Denizli'de."),
      })
      const publishedPage = await settle(
        http.post(`/admin/content/${about}`, { status: "published" }, asOwner)
      )
      expect(publishedPage.status).toBe(200)
      const fresh = await content({ kind: "page", title: "Yeni sayfa", body: doc("Taslak.") })
      const post = await content({ kind: "post", title: "Bıçak bakımı", body: doc("Yağlayın.") })
      const save = (pages: unknown[]) =>
        settle(
          http.post<AdminAnswer>(
            "/admin/storefront-layout",
            { document: { header: [], home: [], footer: [], pages } },
            asOwner
          )
        )
      const read = (path: string) => settle(http.get<PageAnswer>(path, { headers: store.headers }))

      // A post is no page to lay out; a malformed id is no page at all
      const asPost = await save([{ page_id: post, sections: [help("yardim001")] }])
      expect(asPost.status).toBe(400)
      expect(asPost.data.message).toBe("storefront_layout.page_invalid")
      const malformed = await save([{ page_id: "/hakkimizda", sections: [help("yardim001")] }])
      expect(malformed.status).toBe(400)

      const saved = await save([
        { page_id: about, sections: [help("yardim001", { placement: "top" }), help("yardim002")] },
        { page_id: fresh, sections: [help("yardim003")] },
      ])
      expect(saved.status).toBe(200)
      expect(saved.data.dropped_pages).toBe(0)
      expect(saved.data.layout.draft.pages.map((page) => page.page_id)).toEqual([about, fresh])

      // Nothing published yet: the live page has no layout, the design's answer carries none
      expect((await read(`/store/storefront-layout/pages/${about}`)).data.page).toBeNull()
      const published = await settle(
        http.post<AdminAnswer>("/admin/storefront-layout/publish", {}, asOwner)
      )
      expect(published.status).toBe(200)
      expect(published.data.dropped_pages).toBe(0)

      const live = await read(`/store/storefront-layout/pages/${about}`)
      expect(live.status).toBe(200)
      expect(live.headers["cache-control"]).toContain("public")
      expect(live.data.page?.page_id).toBe(about)
      expect(live.data.page?.sections.map((section) => [section.id, section["placement"]])).toEqual(
        [
          ["yardim001", "top"],
          ["yardim002", "bottom"],
        ]
      )
      const whole = await read("/store/storefront-layout")
      expect(whole.data).not.toHaveProperty("layout.pages")
      // A draft page is not live: no layout leaves through the public read
      expect((await read(`/store/storefront-layout/pages/${fresh}`)).data.page).toBeNull()
      expect((await read(`/store/storefront-layout/pages/${post}`)).status).toBe(404)
      expect((await read("/store/storefront-layout/pages/hakkimizda")).status).toBe(404)

      // The signed design link: the draft's layout of a live page, never a draft page's
      const link = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const token = link.data.path.split("/").pop() ?? ""
      const previewed = await read(`/store/storefront-layout/preview/${token}/pages/${about}`)
      expect(previewed.status).toBe(200)
      expect(previewed.headers["cache-control"]).toBe("private, no-store")
      expect(previewed.data.page?.sections).toHaveLength(2)
      expect(
        (await read(`/store/storefront-layout/preview/${token}/pages/${fresh}`)).data.page
      ).toBeNull()
      expect(
        (await read(`/store/storefront-layout/preview/${token.slice(0, -2)}xx/pages/${about}`))
          .status
      ).toBe(404)

      // The page deleted: the next save and the next publication leave its layout out
      expect((await settle(http.delete(`/admin/content/${fresh}`, asOwner))).status).toBe(200)
      const again = await save([
        { page_id: about, sections: [help("yardim001")] },
        { page_id: fresh, sections: [help("yardim003")] },
      ])
      expect(again.status).toBe(200)
      expect(again.data.dropped_pages).toBe(1)
      expect(again.data.layout.draft.pages.map((page) => page.page_id)).toEqual([about])

      // Restoring the first publication brings back only the pages still there
      const restored = await settle(
        http.post<AdminAnswer>("/admin/storefront-layout/revisions/1/restore", {}, asOwner)
      )
      expect(restored.status).toBe(200)
      expect(restored.data.dropped_pages).toBe(1)
      expect(restored.data.layout.draft.pages.map((page) => page.page_id)).toEqual([about])
    })

    it("shows the editor's live session a draft page with its layout and the page itself", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const made = await settle(
        http.post<{ entry: { id: string } }>(
          "/admin/content",
          { kind: "page", title: "Yeni sayfa", body: doc("Henüz yayında değil.") },
          asOwner
        )
      )
      const draftPage = made.data.entry.id
      const saved = await settle(
        http.post(
          "/admin/storefront-layout",
          {
            document: {
              header: [],
              home: [],
              footer: [],
              pages: [{ page_id: draftPage, sections: [help("yardim001")] }],
            },
          },
          asOwner
        )
      )
      expect(saved.status).toBe(200)
      const cookie = sessionCookie(await http.post("/auth/session", {}, { headers: owner.plain }))
      const opened = await settle(
        http.post<{ path: string }>(
          "/admin/storefront-layout/editor-session",
          {},
          { headers: { cookie, origin: adminOrigin() } }
        )
      )
      expect(opened.status).toBe(200)
      const token = opened.data.path.split("/").pop() ?? ""

      const read = await settle(
        http.get<PageAnswer>(`/store/storefront-layout/session/${token}/pages/${draftPage}`, {
          headers: store.headers,
        })
      )
      expect(read.status).toBe(200)
      expect(read.headers["cache-control"]).toBe("private, no-store")
      expect(read.data.page?.sections.map((section) => section.id)).toEqual(["yardim001"])
      expect(read.data.entry).toMatchObject({ id: draftPage, title: "Yeni sayfa" })
      expect(typeof read.data.edition).toBe("string")

      // Altered, it opens nothing; a page that is not one is a 404 behind the session
      const altered = await settle(
        http.get(`/store/storefront-layout/session/${token.slice(0, -2)}xx/pages/${draftPage}`, {
          headers: store.headers,
        })
      )
      expect(altered.status).toBe(404)
      const unknown = await settle(
        http.get(`/store/storefront-layout/session/${token}/pages/cnt_01KNOSUCHPAGE0000000000`, {
          headers: store.headers,
        })
      )
      expect(unknown.status).toBe(404)
    })
  },
})

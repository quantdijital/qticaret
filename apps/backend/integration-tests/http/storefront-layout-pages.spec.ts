import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { writePageText } from "../helpers/pages"
import { adminOrigin, sessionCookie } from "../helpers/staff-account"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface PageLayout {
  page_id: string
  sections: Section[]
  synthesized?: true
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
      const about = await content({ kind: "page", title: "Hakkımızda" })
      // A page's text is the system's to write (adr/0073 Ek 2026-11-19 (2) K4): no design yet,
      // only its mirror
      await writePageText(container, about, doc("Atölyemiz Denizli'de."))
      const publishedPage = await settle(
        http.post(`/admin/content/${about}`, { status: "published" }, asOwner)
      )
      expect(publishedPage.status).toBe(200)
      const fresh = await content({ kind: "page", title: "Yeni sayfa" })
      await writePageText(container, fresh, doc("Taslak."))
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

      const article = {
        id: "metin00001",
        type: "rich_text",
        variant: "article",
        body: doc("Atölyemiz Denizli'de."),
      }
      // One list (adr/0073 Ek 2026-11-19 (2) K1): no editor sends a page's `placement` any more,
      // and the save no longer folds one (S9)
      const placed = await save([
        { page_id: about, sections: [help("yardim001", { placement: "top" }), help("yardim002")] },
      ])
      expect(placed.status).toBe(400)

      const saved = await save([
        { page_id: about, sections: [help("yardim001"), article, help("yardim002")] },
        { page_id: fresh, sections: [help("yardim003")] },
      ])
      expect(saved.status).toBe(200)
      expect(saved.data.dropped_pages).toBe(0)
      expect(saved.data.layout.draft.pages.map((page) => page.page_id)).toEqual([about, fresh])
      const [aboutDraft, freshDraft] = saved.data.layout.draft.pages
      expect(aboutDraft?.sections.map((section) => [section.type, section["variant"]])).toEqual([
        ["help", undefined],
        ["rich_text", "article"],
        ["help", undefined],
      ])
      expect(aboutDraft?.sections[0]).not.toHaveProperty("placement")
      expect(aboutDraft?.sections[1]?.["body"]).toEqual(doc("Atölyemiz Denizli'de."))
      expect(freshDraft?.sections.map((section) => section.id)).toEqual(["yardim003"])

      // Nothing published yet: the live page is its text alone, made from its mirror (K1)
      const before = await read(`/store/storefront-layout/pages/${about}`)
      expect(before.data.page).toMatchObject({ page_id: about, synthesized: true })
      expect(before.data.page?.sections.map((section) => section["variant"])).toEqual(["article"])
      expect(before.data.page?.sections[0]?.["html"]).toContain("Atölyemiz Denizli")
      const published = await settle(
        http.post<AdminAnswer>("/admin/storefront-layout/publish", {}, asOwner)
      )
      expect(published.status).toBe(200)
      expect(published.data.dropped_pages).toBe(0)

      const live = await read(`/store/storefront-layout/pages/${about}`)
      expect(live.status).toBe(200)
      expect(live.headers["cache-control"]).toContain("public")
      expect(live.data.page?.page_id).toBe(about)
      expect(live.data.page).not.toHaveProperty("synthesized")
      expect(live.data.page?.sections.map((section) => section.type)).toEqual([
        "help",
        "rich_text",
        "help",
      ])
      expect(live.data.page?.sections.map((section) => section["placement"])).toEqual([
        undefined,
        undefined,
        undefined,
      ])
      const whole = await read("/store/storefront-layout")
      expect(whole.data).not.toHaveProperty("layout.pages")
      // A draft page is not live: no layout leaves through the public read, and every page
      // not to be seen answers alike (security review 2026-11-19, S1): no existence oracle
      const answerOf = async (path: string) => {
        const got = await read(path)
        return { status: got.status, body: got.data }
      }
      const hidden = await answerOf(`/store/storefront-layout/pages/${fresh}`)
      expect(hidden).toEqual({ status: 200, body: { page: null } })
      for (const id of [post, "cnt_01KNOSUCHPAGE0000000000", "hakkimizda"]) {
        expect(await answerOf(`/store/storefront-layout/pages/${id}`)).toEqual(hidden)
      }

      // The signed design link: the draft's layout of a live page, never a draft page's
      const link = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const token = link.data.path.split("/").pop() ?? ""
      const previewed = await read(`/store/storefront-layout/preview/${token}/pages/${about}`)
      expect(previewed.status).toBe(200)
      expect(previewed.headers["cache-control"]).toBe("private, no-store")
      expect(previewed.data.page?.sections).toHaveLength(3)
      const hiddenByLink = await answerOf(
        `/store/storefront-layout/preview/${token}/pages/${fresh}`
      )
      expect(hiddenByLink).toEqual({ status: 200, body: { page: null } })
      for (const id of [post, "cnt_01KNOSUCHPAGE0000000000", "hakkimizda"]) {
        expect(await answerOf(`/store/storefront-layout/preview/${token}/pages/${id}`)).toEqual(
          hiddenByLink
        )
      }
      // A design link is no live session (security review 2026-11-19, S3)
      expect((await read(`/store/storefront-layout/session/${token}/pages/${about}`)).status).toBe(
        404
      )
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

      // Deleted, it answers as a page that never was
      expect(await answerOf(`/store/storefront-layout/pages/${fresh}`)).toEqual(hidden)

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
          { kind: "page", title: "Yeni sayfa" },
          asOwner
        )
      )
      const draftPage = made.data.entry.id
      await writePageText(container, draftPage, doc("Henüz yayında değil."))
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
      // A live session is no design link (security review 2026-11-19, S3)
      const asLink = await settle(
        http.get(`/store/storefront-layout/preview/${token}/pages/${draftPage}`, {
          headers: store.headers,
        })
      )
      expect(asLink.status).toBe(404)
    })
  },
})

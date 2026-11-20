import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { adminOrigin, sessionCookie } from "../helpers/staff-account"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

const doc = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
})
const article = (id: string, body: unknown) => ({ id, type: "rich_text", variant: "article", body })

/**
 * adr/0073 §6, Ek 2026-11-19 (2) K1: a content page's layout, its text
 * among it, is read per page only; the whole design's reads (live, the
 * signed design link, the editor's live session) never carry the pages.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("never answers the pages in the whole design's reads", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const about = (
        await settle(
          http.post<{ entry: { id: string } }>(
            "/admin/content",
            { kind: "page", title: "Hakkımızda", status: "published" },
            asOwner
          )
        )
      ).data.entry.id
      const pages = [
        { page_id: about, sections: [article("metin00001", doc("Gizli kalmayan metin."))] },
      ]
      await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages } },
          asOwner
        )
      )
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const link = await settle(
        http.post<{ path: string }>("/admin/storefront-layout/preview", {}, asOwner)
      )
      const linkToken = link.data.path.split("/").pop() ?? ""
      const cookie = sessionCookie(await http.post("/auth/session", {}, { headers: owner.plain }))
      const opened = await settle(
        http.post<{ path: string }>(
          "/admin/storefront-layout/editor-session",
          {},
          { headers: { cookie, origin: adminOrigin() } }
        )
      )
      const sessionToken = opened.data.path.split("/").pop() ?? ""

      // A page's layout is read per page only (adr/0073 §6): the whole design carries none
      for (const path of [
        "/store/storefront-layout",
        `/store/storefront-layout/preview/${linkToken}`,
        `/store/storefront-layout/session/${sessionToken}`,
      ]) {
        const read = await settle(http.get<{ layout?: unknown }>(path, { headers: store.headers }))
        expect(read.status).toBe(200)
        expect(read.data.layout).toBeDefined()
        expect(read.data).not.toHaveProperty("layout.pages")
        const text = JSON.stringify(read.data)
        expect(text).not.toContain(about)
        expect(text).not.toContain("Gizli kalmayan metin.")
      }
    })
  },
})

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface AuditEntry {
  action: string
  resource_type: string | null
  resource_id: string | null
  outcome: number | null
  changes: { diff?: Record<string, { before?: unknown; after?: unknown }> } | null
}

interface AdminLayout {
  layout: { draft: Record<string, unknown> & { settings: Record<string, unknown> } }
}

const link = (target: string, label: string | null = null) => ({
  link: { kind: "system", target, label },
})

/**
 * adr/0011, adr/0063 §3: the theme and the menus change with a publication
 * and a restored revision; both are recorded with what they changed.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("records a publication and a restore with the theme and menus before and after", async () => {
      const owner = await createAdminUser(http, getContainer())
      const asOwner = { headers: owner.headers }
      // Written once the response has finished: they may land a moment after it
      const entry = async (action: string): Promise<AuditEntry | undefined> => {
        for (let attempt = 0; attempt < 30; attempt++) {
          const { data } = await http.get<{ audit_entries: AuditEntry[] }>(
            "/admin/audit-log?resource_type=storefront_layout&limit=100",
            asOwner
          )
          const found = data.audit_entries.find((each) => each.action === action)
          if (found) {
            return found
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        return undefined
      }

      await settle(
        http.post(
          "/admin/storefront-menus",
          { title: "Mağaza menüsü", location: "main", items: [link("home"), link("blog")] },
          asOwner
        )
      )
      const { draft } = (await settle(http.get<AdminLayout>("/admin/storefront-layout", asOwner)))
        .data.layout
      const theme = { ...(draft.settings["theme"] as object), radius: "round" }
      const menus = [
        { title: "Görünüm menüsü", location: "main", items: [link("shop")] },
        { title: "Kurumsal", location: "footer", items: [link("blog"), link("cart")] },
      ]
      const saved = await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { ...draft, settings: { ...draft.settings, theme, menus } } },
          asOwner
        )
      )
      const published = await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))
      const publication = await entry("POST /admin/storefront-layout/publish")
      const restored = await settle(
        http.post("/admin/storefront-layout/revisions/1/restore", {}, asOwner)
      )
      const restore = await entry("POST /admin/storefront-layout/revisions/:revision/restore")

      expect(saved.status).toBe(200)
      expect(published.status).toBe(200)
      expect(publication).toMatchObject({ resource_type: "storefront_layout", outcome: 200 })
      // Never published before: no theme of the design's; the shop's menu replaced by the set
      expect(publication?.changes?.diff).toMatchObject({
        theme: { before: null },
        "theme.radius": { after: "round" },
        "theme.settings_version": { after: 2 },
        "menus.main.title": { before: "Mağaza menüsü", after: "Görünüm menüsü" },
        "menus.main.links": { before: 2, after: 1 },
        "menus.footer_1.title": { after: "Kurumsal" },
        "menus.footer_1.links": { after: 2 },
      })

      // The draft gets the revision's set back; its theme is the one already drafted
      expect(restored.status).toBe(200)
      expect(restore).toMatchObject({ resource_id: "1", outcome: 200 })
      expect(restore?.changes?.diff).toEqual({
        menus: { before: null },
        "menus.main.title": { after: "Görünüm menüsü" },
        "menus.main.links": { after: 1 },
        "menus.footer_1.title": { after: "Kurumsal" },
        "menus.footer_1.links": { after: 2 },
      })
    })

    it("records the pages a publication takes live, by id, draft to live", async () => {
      const owner = await createAdminUser(http, getContainer())
      const asOwner = { headers: owner.headers }
      const made = await settle(
        http.post<{ entry: { id: string } }>(
          "/admin/content",
          { kind: "page", title: "Yeni sayfa" },
          asOwner
        )
      )
      const page = made.data.entry.id
      const pages = [
        { page_id: page, sections: [{ id: "yardim001", type: "help", title: "Bize yazın" }] },
      ]
      await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages } },
          asOwner
        )
      )
      const published = await settle(
        http.post("/admin/storefront-layout/publish", { pages_live: [page] }, asOwner)
      )
      expect(published.status).toBe(200)

      let publication: AuditEntry | undefined
      for (let attempt = 0; attempt < 30 && !publication; attempt++) {
        const { data } = await http.get<{ audit_entries: AuditEntry[] }>(
          "/admin/audit-log?resource_type=storefront_layout&limit=100",
          asOwner
        )
        publication = data.audit_entries.find(
          (each) => each.action === "POST /admin/storefront-layout/publish"
        )
        if (!publication) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
      // adr/0073 Ek 2026-11-19 (2) K5: the page's id and status only, never its title or text
      expect(publication?.changes?.diff?.[`pages_live.${page}.status`]).toEqual({
        before: "draft",
        after: "published",
      })
      expect(JSON.stringify(publication?.changes)).not.toContain("Yeni sayfa")
    })
  },
})

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { layouts } from "../../src/workflows/storefront/layout-row"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { writePageText } from "../helpers/pages"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

const doc = (...values: string[]) => ({
  type: "doc",
  content: values.map((value) => ({ type: "paragraph", content: [{ type: "text", text: value }] })),
})
const help = (id: string) => ({ id, type: "help", title: "Hangi bıçak size uygun?" })
const kindOf = (section: Section) =>
  section.type === "rich_text" ? `rich_text:${String(section["variant"])}` : section.type

/**
 * adr/0073 Ek 2026-11-19 (2) K6: a revision kept before a page's text was
 * a section (`placement`, no text) restored into the draft takes the
 * page's text as it is today where it stood: a restore never takes a
 * page's text away.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("restores a revision from before the text was a section with today's text where it stood", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
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
      await writePageText(container, about, doc("Dünkü metin."))
      // An older editor lays the page out above and below its text (revision 1)
      const older = {
        page_id: about,
        sections: [
          { ...help("ustyardim1"), placement: "top" },
          { ...help("altyardim1"), placement: "bottom" },
        ],
      }
      await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages: [older] } },
          asOwner
        )
      )
      await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))
      const [first] = await layouts(container).listStorefrontLayoutRevisions(
        { revision: 1 },
        { select: ["id", "document"] }
      )
      if (!first) {
        throw new Error("no revision")
      }
      // As revision 1 was kept before the text was a section: `placement`, no text
      const document = first.document as { pages: unknown[] }
      await layouts(container).updateStorefrontLayoutRevisions({
        id: first.id,
        document: { ...document, pages: [older] },
      })
      // Today's text, written since (an import): into the draft and live
      await writePageText(container, about, doc("Bugünkü metin."))

      const restored = await settle(
        http.post<{ layout: { draft: { pages: { page_id: string; sections: Section[] }[] } } }>(
          "/admin/storefront-layout/revisions/1/restore",
          {},
          asOwner
        )
      )
      expect(restored.status).toBe(200)
      const [entry] = restored.data.layout.draft.pages
      expect(entry?.sections.map(kindOf)).toEqual(["help", "rich_text:article", "help"])
      expect(entry?.sections.map((section) => section.id)).toContain("ustyardim1")
      // Never a text taken away: the page's text as it is today, where it stood
      expect(entry?.sections[1]?.["body"]).toEqual(doc("Bugünkü metin."))
    })

    it("saves and publishes an older page whose text names a card and a picture gone since", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
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
      // The page's text from before, naming a product and a library picture since removed
      const gone = { type: "productCard", attrs: { id: `prod_${"01KGONE".padEnd(26, "0")}` } }
      const picture = { type: "image", attrs: { src: "https://cdn.example.com/silinen.webp" } }
      const old = { type: "doc", content: [...doc("Eski metin.").content, gone, picture] }
      await container
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .updateContentEntries({ id: about, body: old })
      const older = {
        page_id: about,
        sections: [{ ...help("ustyardim1"), placement: "top" }],
      }

      // The editor's save places the text from its mirror: not its own work, not refused (K2)
      const saved = await settle(
        http.post<{
          message?: string
          layout: { draft: { pages: { page_id: string; sections: Section[] }[] } }
        }>(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages: [older] } },
          asOwner
        )
      )
      expect([saved.status, saved.data.message]).toEqual([200, undefined])
      const [entry] = saved.data.layout.draft.pages
      expect(entry?.sections.map(kindOf)).toEqual(["help", "rich_text:article"])
      expect(entry?.sections[1]?.["body"]).toEqual(old)
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      // The editor's own new card for no product is still refused
      const added = {
        ...entry,
        sections: [
          ...(entry?.sections ?? []),
          {
            id: "yenimetin1",
            type: "rich_text",
            variant: "pane",
            body: {
              type: "doc",
              content: [
                { type: "productCard", attrs: { id: `prod_${"01KNEWGONE".padEnd(26, "0")}` } },
              ],
            },
          },
        ],
      }
      const refused = await settle(
        http.post<{ message?: string }>(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages: [added] } },
          asOwner
        )
      )
      expect([refused.status, refused.data.message]).toEqual([400, "content.card_unknown"])
    })
  },
})

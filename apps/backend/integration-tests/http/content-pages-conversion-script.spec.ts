import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import contentPagesIntoLayout from "../../src/migration-scripts/content-pages-into-layout"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { layoutRow, layouts } from "../../src/workflows/storefront/layout-row"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { writePageText } from "../helpers/pages"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }
type Stored = Record<string, unknown> & { pages?: { page_id: string; sections: Section[] }[] }

const doc = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
})
const help = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  type: "help",
  title: "Hangi bıçak size uygun?",
  ...more,
})
const kinds = (stored: Stored, pageId: string) =>
  stored.pages
    ?.find((page) => page.page_id === pageId)
    ?.sections.map((section) =>
      section.type === "rich_text" ? `rich_text:${String(section["variant"])}` : section.type
    ) ?? null

/**
 * adr/0073 Ek 2026-11-19 (2) K3: the `db:migrate` script
 * (`migration-scripts/content-pages-into-layout.ts`) on a shop whose
 * design was never published: the draft converted, nothing made live, a
 * page whose stored text does not read passed over; twice, the same.
 * The conversion itself: `content-pages-conversion.spec.ts`.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("runs as the db:migrate script on an older design: draft only, a page that will not read passed over", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const page = async (title: string) =>
        (
          await settle(
            http.post<{ entry: { id: string } }>(
              "/admin/content",
              { kind: "page", title, status: "published" },
              asOwner
            )
          )
        ).data.entry.id
      const story = await page("Hikâyemiz")
      const broken = await page("Bozuk metin")
      await writePageText(container, story, doc("Bir bileme tezgâhında başladı."))
      const content = container.resolve<ContentModuleService>(CONTENT_MODULE)
      // A stored text no schema reads: left to its mirror, the others still move
      await content.updateContentEntries({ id: broken, body: { type: "nope" } })
      // A design saved but never published, from before a page's text was a section
      await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [], footer: [], pages: [] } },
          asOwner
        )
      )
      const made = await layoutRow(container)
      if (!made) {
        throw new Error("no design")
      }
      await layouts(container).updateStorefrontLayouts({
        id: made.id,
        draft: {
          ...(made.draft as Stored),
          pages: [{ page_id: story, sections: [help("altyardim2", { placement: "bottom" })] }],
        },
      })

      await contentPagesIntoLayout({ container, args: [] })
      const row = await layoutRow(container)
      const draftDoc = row?.draft as Stored
      expect(kinds(draftDoc, story)).toEqual(["rich_text:article", "help"])
      expect(kinds(draftDoc, broken)).toBeNull()
      expect(row?.published ?? null).toBeNull()
      expect(row?.revision).toBe(made.revision)

      // Twice: the same design
      await contentPagesIntoLayout({ container, args: [] })
      expect((await layoutRow(container))?.draft).toEqual(row?.draft)
    })
  },
})

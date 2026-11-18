import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { STOREFRONT_LAYOUT_MODULE } from "../../src/modules/storefront-layout"
import type StorefrontLayoutModuleService from "../../src/modules/storefront-layout/service"
import { layoutRow } from "../../src/workflows/storefront/layout-row"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }
type Doc = Record<string, unknown> & { home: Section[] }

interface StoreLayout {
  layout: { home: Section[] }
}
interface AdminLayout {
  layout: { draft: { home: Section[] } }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const badges = (id: string): Section => ({ id, type: "trust_badges", ...ALWAYS, variant: "lined" })
// A type no build reads: taken off since, or written by a newer one
const unknown: Section = { id: "gelecekbolum", type: "future_section", ...ALWAYS }

/**
 * A stored design with a section its group no longer reads (#180 D2):
 * the storefront and the editor read the rest of it, that section
 * skipped; a save naming it is still refused.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    describe("a stored section of an unknown type", () => {
      it("is skipped on reading, and still refused on a save", async () => {
        const container = getContainer()
        const owner = await createAdminUser(http, container)
        const store = await createStorefront(container)
        const asOwner = { headers: owner.headers }
        const save = (home: Section[]) =>
          settle(
            http.post<{ message?: string }>(
              "/admin/storefront-layout",
              { document: { header: [], home, footer: [], product: [], category: [] } },
              asOwner
            )
          )

        expect((await save([badges("ilkguven01"), badges("songuven01")])).status).toBe(200)
        expect(
          (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
        ).toBe(200)

        // Written past the schema, as a build that knew the type would have
        const row = await layoutRow(container)
        const withUnknown = (stored: unknown): Doc => {
          const doc = stored as Doc
          return { ...doc, home: [...doc.home.slice(0, 1), unknown, ...doc.home.slice(1)] }
        }
        await container
          .resolve<StorefrontLayoutModuleService>(STOREFRONT_LAYOUT_MODULE)
          .updateStorefrontLayouts({
            id: row?.id ?? "",
            draft: withUnknown(row?.draft),
            published: withUnknown(row?.published),
          })

        const live = await settle(
          http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
        )
        expect(live.status).toBe(200)
        expect(live.data.layout.home.map((section) => section.id)).toEqual([
          "ilkguven01",
          "songuven01",
        ])

        const editor = await settle(http.get<AdminLayout>("/admin/storefront-layout", asOwner))
        expect(editor.status).toBe(200)
        expect(editor.data.layout.draft.home.map((section) => section.id)).toEqual([
          "ilkguven01",
          "songuven01",
        ])

        const refused = await save([badges("ilkguven01"), unknown])
        expect(refused.status).toBe(400)
        expect(refused.data.message).toBe("storefront_layout.section_invalid")
      })
    })
  },
})

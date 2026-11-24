import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Section = Record<string, unknown> & { id: string; type: string }

interface AdminLayoutAnswer {
  message?: string
  layout: { missing_targets: string[] }
}

interface StoreLayout {
  layout: { home: Section[] }
}

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const document = (home: Section[]) => ({
  document: { header: [], home, footer: [], product: [], category: [] },
})

/**
 * A record a saved design names, deleted since ("engel değil uyarı"): the
 * storefront leaves it out, every other change still saves and publishes,
 * the editor's read names the section (`missing_targets`); a record the
 * save names anew must still exist.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("saves around a deleted category, marks its section and refuses a new unknown one", async () => {
      const container = getContainer()
      const owner = await createAdminUser(http, container)
      const store = await createStorefront(container)
      const asOwner = { headers: owner.headers }
      const category = async (name: string) =>
        (
          await settle(
            http.post<{ product_category: { id: string } }>(
              "/admin/product-categories",
              { name, is_active: true },
              asOwner
            )
          )
        ).data.product_category.id
      const kept = await category("Çakılar")
      const gone = await category("Kamp Baltaları")
      const grid = (ids: string[], more: Record<string, unknown> = {}): Section => ({
        id: "kategoriler",
        type: "categories",
        ...ALWAYS,
        category_ids: ids,
        show_count: true,
        more: null,
        ...more,
      })
      const goneGrid: Section = { ...grid([gone]), id: "baltalar" }
      const save = (home: Section[]) =>
        settle(http.post<AdminLayoutAnswer>("/admin/storefront-layout", document(home), asOwner))

      expect((await save([grid([kept]), goneGrid])).status).toBe(200)
      const deleted = await settle(http.delete(`/admin/product-categories/${gone}`, asOwner))
      expect(deleted.status).toBe(200)

      // Another change saves although a section still names the deleted category
      const changed = await save([grid([kept], { show_count: false }), goneGrid])
      expect(changed.status).toBe(200)
      expect(changed.data.layout.missing_targets).toEqual(["baltalar"])
      const read = await settle(http.get<AdminLayoutAnswer>("/admin/storefront-layout", asOwner))
      expect(read.data.layout.missing_targets).toEqual(["baltalar"])

      // A record the save names anew must exist
      const unknown = await save([grid([kept, "pcat_yok"]), goneGrid])
      expect([unknown.status, unknown.data.message]).toEqual([
        400,
        "storefront_layout.target_unknown",
      ])

      // Published: the storefront leaves the emptied section out
      expect(
        (await settle(http.post("/admin/storefront-layout/publish", {}, asOwner))).status
      ).toBe(200)
      const live = await settle(
        http.get<StoreLayout>("/store/storefront-layout", { headers: store.headers })
      )
      expect(live.data.layout.home.map((section) => section.id)).toEqual(["kategoriler"])

      // Picked again: nothing marked
      const fixed = await save([grid([kept], { show_count: false })])
      expect(fixed.data.layout.missing_targets).toEqual([])
    })
  },
})

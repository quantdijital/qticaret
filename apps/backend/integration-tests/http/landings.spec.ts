import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { doc, landingKit, words } from "../helpers/landings"
import type { LandingKit } from "../helpers/landings"

jest.setTimeout(180 * 1000)

/** F3.16 (docs/13 §7, docs/14 §3.7): facet landing pages and their originality gate (KK). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
    })

    it("gives a category and facet their own page under the category's path", async () => {
      const made = await kit.landing("seramik", {
        title: "Seramik kupalar",
        status: "published",
        body: doc(words("seramik", 320)),
      })
      expect(made.status).toBe(201)
      expect(made.data.landing).toMatchObject({
        path: "/kategori/ev-ve-yasam/seramik",
        originality: 100,
        product_count: 3,
        facet: { label: "Seramik" },
      })
      const answer = await kit.resolve("/kategori/ev-ve-yasam/seramik")
      expect(answer).toMatchObject({ type: "entity", entity_type: "landing" })
      expect(answer.seo?.title.startsWith("Seramik kupalar |")).toBe(true)
      expect(answer.seo?.breadcrumbs.map((crumb) => crumb.name)).toContain("Seramik kupalar")

      const { id } = made.data.landing
      const products = await settle(
        http.get<{ product_ids: string[]; count: number }>(`/store/landings/${id}/products`, {
          headers: kit.store.headers,
        })
      )
      expect(products.data).toMatchObject({ count: 3 })
    })

    it("does not publish a page whose text copies another's (KK: under 30% its own)", async () => {
      const text = words("ortak", 320)
      await kit.landing("seramik", {
        title: "Seramik kupalar",
        status: "published",
        body: doc(text),
      })
      const copy = await kit.landing("porselen", {
        title: "Porselen kupalar",
        status: "published",
        body: doc(text),
      })
      expect([copy.status, copy.data.message]).toEqual([400, "content.landing_not_original"])
      const draft = await kit.landing("porselen", { title: "Porselen kupalar", body: doc(text) })
      expect(draft.status).toBe(201)
      expect(draft.data.landing.originality).toBeLessThan(30)
    })

    it.each([
      ["an option that is no option", "celik", "content.landing_facet_unknown"],
      ["a second page for one facet", "seramik", "content.landing_exists"],
    ])("refuses %s", async (_label, value, message) => {
      await kit.landing("seramik", { title: "Seramik kupalar" })
      const refused = await kit.landing(value, { title: "Başka" })
      expect([refused.status, refused.data.message]).toEqual([400, message])
    })

    it("follows its category's path, and goes out of sight with it", async () => {
      const made = await kit.landing("seramik", {
        title: "Seramik kupalar",
        status: "published",
        body: doc(words("seramik", 320)),
      })
      const renamed = await kit.post(`/admin/product-categories/${kit.categoryId}`, {
        handle: "ev",
      })
      expect(renamed.status).toBe(200)
      expect(await kit.resolve("/kategori/ev-ve-yasam/seramik")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/kategori/ev/seramik",
      })

      await kit.post(`/admin/product-categories/${kit.categoryId}`, { is_active: false })
      expect((await kit.resolve("/kategori/ev/seramik")).type).toBe("not_found")
      const hidden = await settle(
        http.get(`/store/landings/${made.data.landing.id}`, { headers: kit.store.headers })
      )
      expect(hidden.status).toBe(404)
    })
  },
})

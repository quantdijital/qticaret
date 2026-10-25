import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedDemo } from "../../src/scripts/seed"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface SeoResponse {
  seo: Record<string, string | null>
  duplicates?: { seo_title: number; seo_description: number }
}

async function idOf(container: MedusaContainer, entity: string, handle: string) {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity, fields: ["id"], filters: { handle } })
  return (data[0] as { id: string }).id
}

/** F3.4 (adr/0015): a page's own SEO fields, kept off the Store API. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let kupa: string
    let gomlek: string

    const put = (path: string, body: object) =>
      settle(http.put<SeoResponse>(`/admin/seo/${path}`, body, { headers: admin.headers }))
    const get = (path: string) =>
      settle(http.get<SeoResponse>(`/admin/seo/${path}`, { headers: admin.headers }))

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      await seedDemo(container)
      kupa = await idOf(container, "product", "seramik-kupa")
      gomlek = await idOf(container, "product", "keten-gomlek")
    })

    it("saves fields, keeps the ones left out, clears with null or an empty text", async () => {
      expect((await get(`product/${kupa}`)).data.seo).toMatchObject({
        seo_title: null,
        robots_override: null,
      })

      const saved = await put(`product/${kupa}`, {
        seo_title: "Seramik Kupa | El Yapımı",
        seo_description: "Fırınlanmış seramikten el yapımı kupa.",
        focus_keyword: "seramik kupa",
        canonical_override: "/urun/seramik-kupa",
        robots_override: "noindex_follow",
      })
      expect(saved.status).toBe(200)
      expect(saved.data.duplicates).toEqual({ seo_title: 0, seo_description: 0 })

      await put(`product/${kupa}`, { seo_title: "Seramik Kupa" })
      const partial = await get(`product/${kupa}`)
      expect(partial.data.seo).toMatchObject({
        seo_title: "Seramik Kupa",
        focus_keyword: "seramik kupa",
        robots_override: "noindex_follow",
      })

      await put(`product/${kupa}`, { focus_keyword: null, canonical_override: "" })
      expect((await get(`product/${kupa}`)).data.seo).toMatchObject({
        seo_title: "Seramik Kupa",
        focus_keyword: null,
        canonical_override: null,
      })
    })

    it("warns about a title another product already has, without refusing it", async () => {
      await put(`product/${kupa}`, { seo_title: "Hafta Sonu İndirimi" })
      const second = await put(`product/${gomlek}`, { seo_title: "  hafta sonu  indirimi " })

      expect(second.status).toBe(200)
      expect(second.data.duplicates).toEqual({ seo_title: 1, seo_description: 0 })
    })

    it("refuses outside canonicals, long texts, unknown fields, files and pages", async () => {
      const outside = await put(`product/${kupa}`, { canonical_override: "https://rakip.com/kupa" })
      const long = await put(`product/${kupa}`, { seo_title: "a".repeat(151) })
      const unknown = await put(`product/${kupa}`, { seo_score: 90 })
      const file = await put(`product/${kupa}`, { og_image_override: "file_01NOPE" })
      const type = await put(`brandz/${kupa}`, { seo_title: "x" })
      const page = await put("product/prod_01NOSUCHPRODUCT", { seo_title: "x" })

      expect([outside.status, long.status, unknown.status, file.status]).toEqual([
        400, 400, 400, 400,
      ])
      expect(type.status).toBe(404)
      expect(page.status).toBe(404)
    })

    it("works for categories too", async () => {
      const giyim = await idOf(getContainer(), "product_category", "giyim")
      const saved = await put(`category/${giyim}`, { seo_title: "Giyim | Demo" })

      expect(saved.status).toBe(200)
      expect(saved.data.seo["seo_title"]).toBe("Giyim | Demo")
    })

    it("keeps the raw fields off the Store API", async () => {
      await put(`product/${kupa}`, { focus_keyword: "gizli anahtar" })
      const store = await createStorefront(getContainer())
      const ask = (fields: string) =>
        settle(
          http.get(`/store/products?fields=${encodeURIComponent(fields)}`, {
            headers: store.headers,
          })
        )

      for (const fields of [
        "*seo_meta",
        "seo_meta.focus_keyword",
        "+seo_meta.*",
        "id,variants.product.seo_meta",
      ]) {
        const answer = await ask(fields)
        expect(answer.status).toBe(400)
        expect(JSON.stringify(answer.data)).not.toContain("gizli anahtar")
      }
    })

    it("records the change field by field and goes with the product", async () => {
      await put(`product/${kupa}`, { seo_title: "Önce" })
      await put(`product/${kupa}`, { seo_title: "Sonra" })

      // Entries are written after the answer: wait for the second save's
      interface Entry {
        changes?: { diff?: { seo_title?: { after?: unknown } } }
      }
      let entry: Entry | undefined
      for (let attempt = 0; attempt < 30 && !entry; attempt++) {
        const { data } = await http.get<{ audit_entries: Entry[] }>(
          "/admin/audit-log?resource_type=seo_meta&limit=5",
          { headers: admin.headers }
        )
        entry = data.audit_entries.find((each) => each.changes?.diff?.seo_title?.after === "Sonra")
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(entry?.changes?.diff).toMatchObject({ seo_title: { before: "Önce", after: "Sonra" } })

      await http.delete(`/admin/products/${kupa}`, { headers: admin.headers })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "seo_meta", fields: ["id"], filters: { seo_title: "Sonra" } })
      expect(data).toHaveLength(0)
    })
  },
})

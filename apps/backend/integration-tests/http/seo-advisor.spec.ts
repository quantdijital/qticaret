import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Assessment {
  score: number
  grade: string
  issues: { ruleId: string; severity: string; fix?: { kind: string; action: string } }[]
}

const LONG_TEXT = Array.from({ length: 170 }, (_, index) =>
  index % 7 === 0 ? "keten" : "kumaş"
).join(" ")

const product = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  status: "published",
  description: "Kısa bir açıklama.",
  weight: 250,
  length: 30,
  width: 5,
  height: 2,
  options: [{ title: "Boyut", values: ["Standart"] }],
  variants: [
    {
      title: "Standart",
      options: { Boyut: "Standart" },
      manage_inventory: false,
      prices: [{ currency_code: "try", amount: 1000 }],
    },
  ],
  ...extra,
})

/** F3.13 (docs/14): pages assessed on save and on request, kept for lists and the shop's score. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))
    const assessment = async (kind: string, id: string) =>
      (
        await http.get<{ assessment: Assessment }>(`/admin/seo/assessments/${kind}/${id}`, {
          headers: admin.headers,
        })
      ).data.assessment
    const rules = (found: Assessment) => found.issues.map(({ ruleId }) => ruleId)

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("finds what a thin product page misses, and scores it higher once fixed", async () => {
      const { data } = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Keten Gömlek")
      )
      const id = data.product.id
      const before = await assessment("product", id)
      expect(rules(before)).toEqual(
        expect.arrayContaining(["P-IMG-01", "P-CONT-01", "P-LINK-01", "P-DATA-02", "P-DATA-03"])
      )
      expect(before.issues[0]).toMatchObject({ ruleId: "P-IMG-01", severity: "critical" })

      const category = await post<{ product_category: { id: string } }>(
        "/admin/product-categories",
        { name: "Giyim", is_active: true }
      )
      await post(`/admin/products/${id}`, {
        description: `<p>${LONG_TEXT}</p>`,
        categories: [{ id: category.data.product_category.id }],
      })
      const after = await assessment("product", id)
      expect(rules(after)).not.toContain("P-CONT-01")
      expect(rules(after)).not.toContain("P-LINK-01")
      // A category but no primary one: the panel can pick it in one click
      expect(after.issues.find(({ ruleId }) => ruleId === "P-DATA-04")?.fix).toEqual({
        kind: "auto",
        action: "set_primary_category",
      })
      expect(after.score).toBeGreaterThan(before.score)

      // The one-click fix sets the deepest category as the primary one
      const fixed = await post<{ assessment: Assessment }>(
        `/admin/seo/assessments/product/${id}/fix`,
        { action: "set_primary_category" }
      )
      expect(rules(fixed.data.assessment)).not.toContain("P-DATA-04")
      expect(fixed.data.assessment.score).toBeGreaterThan(after.score)
    })

    it("assesses a saved page on its own and sums the shop up", async () => {
      const { data } = await post<{ product: { id: string; title: string } }>(
        "/admin/products",
        product("Seramik Kupa")
      )
      let listed: { entity_id: string; score: number }[] = []
      for (let attempt = 0; attempt < 30 && listed.length === 0; attempt++) {
        const response = await http.get<{ assessments: typeof listed }>(
          `/admin/seo/assessments?kind=product&ids=${data.product.id}`,
          { headers: admin.headers }
        )
        listed = response.data.assessments
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(listed[0]?.entity_id).toBe(data.product.id)

      const { data: summary } = await http.get<{
        products: number
        average: number
        critical: number
        lowest: { title: string; score: number }[]
      }>("/admin/seo/assessments/summary", { headers: admin.headers })
      expect(summary).toMatchObject({ products: 1, critical: 1, average: listed[0]?.score })
      expect(summary.lowest[0]?.title).toBe("Seramik Kupa")
    })

    it("keeps an unready product from going live while the publish gate is on", async () => {
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      const { data } = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Taslak Ürün", { status: "draft" })
      )
      await settings.setFeature("seo.publish_gate", true, null)
      try {
        const refused = await post<{ message: string }>(`/admin/products/${data.product.id}`, {
          status: "published",
        })
        expect(refused.status).toBe(400)
        expect(refused.data.message).toBe("seo.publish_gate_blocked")
        // A draft is still saved, and the gate off lets it go live
        expect(
          (await post(`/admin/products/${data.product.id}`, { title: "Taslak Ürün 2" })).status
        ).toBe(200)
      } finally {
        await settings.setFeature("seo.publish_gate", false, null)
      }
      expect(
        (await post(`/admin/products/${data.product.id}`, { status: "published" })).status
      ).toBe(200)
    })

    it("judges a category on its own text and products", async () => {
      const { data } = await post<{ product_category: { id: string } }>(
        "/admin/product-categories",
        { name: "Mutfak", is_active: true }
      )
      const found = await assessment("category", data.product_category.id)
      expect(rules(found)).toEqual(expect.arrayContaining(["C-EMPTY-01", "C-CONT-01"]))
      expect(rules(found).some((rule) => rule.startsWith("P-"))).toBe(false)
      const missing = await settle(
        http.get("/admin/seo/assessments/product/prod_01NOPE", { headers: admin.headers })
      )
      expect(missing.status).toBe(404)
    })
  },
})

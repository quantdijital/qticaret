import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface Counts {
  counts: Record<string, number>
}

/**
 * The panel's category list product counts (docs/06 "Kategoriler"): as
 * the product list's category filter shows, drafts too. The storefront's
 * own counts (published, shown only) are `/store/category-counts`.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const counts = async (headers: Record<string, string>) =>
      settle(http.get<Counts>("/admin/category-counts", { headers }))
    const listed = async (categoryId: string) =>
      (
        await http.get<{ count: number }>(`/admin/product-board?category_id=${categoryId}`, {
          headers: admin.headers,
        })
      ).data.count

    const category = async (name: string, parent?: string) =>
      (
        await post<{ product_category: { id: string } }>("/admin/product-categories", {
          name,
          is_active: true,
          ...(parent ? { parent_category_id: parent } : {}),
        })
      ).data.product_category.id

    async function make(title: string, categories: string[], status = "published") {
      const { data, status: code } = await post<{ product: { id: string } }>("/admin/products", {
        title,
        status,
        categories: categories.map((id) => ({ id })),
        options: [{ title: "Boyut", values: ["Standart"] }],
        variants: [
          {
            title: "Standart",
            options: { Boyut: "Standart" },
            manage_inventory: false,
            prices: [{ currency_code: "try", amount: 1000 }],
          },
        ],
      })
      expect(code).toBe(200)
      return data.product.id
    }

    it("counts each category's products and those below it, drafts too, each once", async () => {
      const knives = await category("Bıçaklar")
      const chef = await category("Şef Bıçakları", knives)
      const boards = await category("Kesme Tahtaları")
      await make("Ağaç Saplı Şef", [chef])
      await make("Çakı", [knives], "draft")
      // In a parent and its child: one product under the parent
      await make("Santoku", [knives, chef])
      const removed = await make("Eski Model", [chef])
      expect(
        (await settle(http.delete(`/admin/products/${removed}`, { headers: admin.headers }))).status
      ).toBe(200)

      const answer = await counts(admin.headers)

      expect(answer.status).toBe(200)
      expect(answer.data.counts).toMatchObject({ [knives]: 3, [chef]: 2, [boards]: 0 })
      // The number the row links to: the product list filtered by it
      expect(answer.data.counts[knives]).toBe(await listed(knives))
      expect(answer.data.counts[chef]).toBe(await listed(chef))
    })

    it("answers every role that reads the catalog, and no one without a session", async () => {
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      expect((await counts(readonly.headers)).status).toBe(200)
      expect((await counts({})).status).toBe(401)
    })
  },
})

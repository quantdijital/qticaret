import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Product {
  id: string
  handle: string
  status: string
  variants: { id: string; title: string; weight: number | null }[]
}

const DIMENSIONS = { weight: 250, length: 30, width: 5, height: 2 }

// Two sizes; `codes` gives each its barcodes (Medusa keeps them unique across variants)
const sizes = (codes: Record<string, string>[] = []) =>
  ["20 cm", "25 cm"].map((size, index) => ({
    title: size,
    options: { Boyut: size },
    manage_inventory: false,
    ...codes[index],
    prices: [{ currency_code: "try", amount: 1000 }],
  }))

const product = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  status: "draft",
  options: [{ title: "Boyut", values: ["20 cm", "25 cm"] }],
  variants: sizes(),
  ...extra,
})

/** F3.1: a physical product is published only with weight and dimensions. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const createProduct = async (body: unknown) =>
      (await post<{ product: Product }>("/admin/products", body)).data.product
    const countByHandle = async (handle: string) =>
      (
        await http.get<{ count: number }>(`/admin/products?handle=${handle}`, {
          headers: admin.headers,
        })
      ).data.count

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    describe("publishing a physical product", () => {
      it("needs weight and dimensions, and a refused create leaves nothing behind", async () => {
        const refused = await post("/admin/products", product("Ölçüsüz", { status: "published" }))
        const draft = await post("/admin/products", product("Taslak Ürün"))
        const published = await post(
          "/admin/products",
          product("Ölçülü", { status: "published", ...DIMENSIONS })
        )

        expect(refused.status).toBe(400)
        expect(refused.data.message).toBe("catalog.dimensions_required")
        expect(await countByHandle("olcusuz")).toBe(0)
        expect(draft.status).toBe(200)
        expect(published.status).toBe(200)
      })

      it("checks a draft when it is published, and every variant", async () => {
        const created = await createProduct(product("Ekmek Bıçağı"))
        const [first, second] = created.variants

        const bare = await post(`/admin/products/${created.id}`, { status: "published" })
        // The product's variant list is the whole list: both stay
        const oneVariant = await post(`/admin/products/${created.id}`, {
          status: "published",
          variants: [{ id: first?.id, ...DIMENSIONS }, { id: second?.id }],
        })
        const withProductValues = await post(`/admin/products/${created.id}`, {
          status: "published",
          ...DIMENSIONS,
        })

        expect(bare.status).toBe(400)
        expect(oneVariant.status).toBe(400)
        expect(withProductValues.status).toBe(200)
      })

      it("refuses a variant change that leaves no weight, and keeps the old value", async () => {
        const created = await createProduct(
          product("Satır", { status: "published", ...DIMENSIONS })
        )
        const variantId = created.variants[0]?.id ?? ""

        const cleared = await post(`/admin/products/${created.id}/variants/${variantId}`, {
          weight: 0,
        })
        const after = await http.get<{ variant: { weight: number | null } }>(
          `/admin/products/${created.id}/variants/${variantId}`,
          { headers: admin.headers }
        )

        expect(cleared.status).toBe(400)
        expect(cleared.data.message).toBe("catalog.dimensions_required")
        expect(after.data.variant.weight).toBeNull()
      })

      it("applies on the batch route too", async () => {
        const batch = await post("/admin/products/batch", {
          create: [product("Toplu Ürün", { status: "published" })],
        })

        expect(batch.status).toBe(400)
        expect(await countByHandle("toplu-urun")).toBe(0)
      })

      it("refuses a new variant without weight on a published product", async () => {
        const created = await createProduct(
          product("Kasap Bıçağı", {
            status: "published",
            options: [{ title: "Boyut", values: ["20 cm", "25 cm", "30 cm"] }],
            variants: sizes().map((variant) => ({ ...variant, ...DIMENSIONS })),
          })
        )

        const added = await post(`/admin/products/${created.id}/variants`, {
          title: "30 cm",
          options: { Boyut: "30 cm" },
          manage_inventory: false,
          prices: [{ currency_code: "try", amount: 1000 }],
        })
        const after = await http.get<{ product: Product }>(`/admin/products/${created.id}`, {
          headers: admin.headers,
        })

        expect(added.status).toBe(400)
        expect(added.data.message).toBe("catalog.dimensions_required")
        expect(after.data.product.variants).toHaveLength(2)
      })

      it("applies on the dashboard's variant batch route", async () => {
        const created = await createProduct(
          product("Fileto Bıçağı", { status: "published", ...DIMENSIONS })
        )

        const batch = await post(`/admin/products/${created.id}/variants/batch`, {
          update: [{ id: created.variants[0]?.id, weight: 0 }],
        })

        expect(batch.status).toBe(400)
      })
    })
  },
})

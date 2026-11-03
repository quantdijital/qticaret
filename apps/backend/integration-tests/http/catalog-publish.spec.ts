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

/**
 * F3.1 as the owner changed it (adr/0054, 2026-11-03): weight and
 * dimensions are optional; a physical product publishes without them and
 * ships as the shop's default parcel.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const createProduct = async (body: unknown) =>
      (await post<{ product: Product }>("/admin/products", body)).data.product

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    describe("publishing a physical product", () => {
      it("needs no weight or dimensions, created live or published later", async () => {
        const bare = await post<{ product: Product }>(
          "/admin/products",
          product("Ölçüsüz", { status: "published" })
        )
        const measured = await post("/admin/products", product("Ölçülü", DIMENSIONS))
        const draft = await createProduct(product("Ekmek Bıçağı"))
        const later = await post<{ product: Product }>(`/admin/products/${draft.id}`, {
          status: "published",
        })
        const batch = await post<{ created: Product[] }>("/admin/products/batch", {
          create: [product("Toplu Ürün", { status: "published" })],
        })

        expect([bare.status, bare.data.product.status]).toEqual([200, "published"])
        expect(measured.status).toBe(200)
        expect([later.status, later.data.product.status]).toEqual([200, "published"])
        expect(batch.status).toBe(200)
        expect(batch.data.created.map((each) => each.status)).toEqual(["published"])
      })

      it("lets a published product's variant lose its weight, or gain one without", async () => {
        const created = await createProduct(
          product("Satır", {
            status: "published",
            options: [{ title: "Boyut", values: ["20 cm", "25 cm", "30 cm"] }],
            variants: sizes().map((variant) => ({ ...variant, ...DIMENSIONS })),
          })
        )
        const variantId = created.variants[0]?.id ?? ""

        const cleared = await post(`/admin/products/${created.id}/variants/${variantId}`, {
          weight: null,
        })
        const added = await post(`/admin/products/${created.id}/variants`, {
          title: "30 cm",
          options: { Boyut: "30 cm" },
          manage_inventory: false,
          prices: [{ currency_code: "try", amount: 1000 }],
        })
        const after = await http.get<{ product: Product }>(`/admin/products/${created.id}`, {
          headers: admin.headers,
        })

        expect(cleared.status).toBe(200)
        expect(added.status).toBe(200)
        expect(after.data.product.status).toBe("published")
        expect(after.data.product.variants).toHaveLength(3)
        expect(after.data.product.variants.find((each) => each.id === variantId)?.weight).toBeNull()
      })
    })
  },
})

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

interface Catalog {
  condition: string
  primary_category_id: string | null
  successor: { id: string; title: string; handle: string } | null
  categories: { id: string; name: string }[]
  variants: { id: string; mpn: string | null; gtin: string | null }[]
}

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

/** F3.1: the product's catalog fields. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const createProduct = async (body: unknown) =>
      (await post<{ product: Product }>("/admin/products", body)).data.product
    const setCatalog = (id: string, body: unknown) =>
      post<Catalog>(`/admin/products/${id}/catalog`, body)
    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    describe("catalog fields", () => {
      const category = async (name: string) =>
        (
          await post<{ product_category: { id: string } }>("/admin/product-categories", {
            name,
            is_active: true,
          })
        ).data.product_category.id

      it("starts as a new item and saves condition, primary category and MPNs", async () => {
        const knives = await category("Bıçaklar")
        const created = await createProduct(
          product("Şef Bıçağı", {
            categories: [{ id: knives }],
            variants: sizes([{ ean: "4006381333931" }, { barcode: "RAF-25" }]),
          })
        )
        // Medusa returns variants in no set order
        const first = created.variants.find((variant) => variant.title === "20 cm")
        const second = created.variants.find((variant) => variant.title === "25 cm")

        const initial = await http.get<Catalog>(`/admin/products/${created.id}/catalog`, {
          headers: admin.headers,
        })
        const saved = await setCatalog(created.id, {
          condition: "refurbished",
          primary_category_id: knives,
          variants: { [first?.id ?? ""]: { mpn: "SB-20" } },
        })

        expect(initial.data).toMatchObject({ condition: "new", primary_category_id: null })
        expect(initial.data.variants).toEqual(
          expect.arrayContaining([
            { id: first?.id, title: "20 cm", sku: null, mpn: null, gtin: "4006381333931" },
            { id: second?.id, title: "25 cm", sku: null, mpn: null, gtin: null },
          ])
        )
        expect(saved.status).toBe(200)
        expect(saved.data).toMatchObject({ condition: "refurbished", primary_category_id: knives })
        expect(saved.data.variants.find((variant) => variant.id === first?.id)?.mpn).toBe("SB-20")

        const kept = await setCatalog(created.id, {
          variants: { [first?.id ?? ""]: { mpn: null } },
        })
        expect(kept.data).toMatchObject({ condition: "refurbished", primary_category_id: knives })
        expect(kept.data.variants.find((variant) => variant.id === first?.id)?.mpn).toBeNull()
      })

      it("takes a primary category only from the product's own", async () => {
        const other = await category("Çatallar")
        const created = await createProduct(product("Tereyağı Bıçağı"))

        const refused = await setCatalog(created.id, { primary_category_id: other })

        expect(refused.status).toBe(400)
        expect(refused.data.message).toBe("catalog.primary_category_not_assigned")
      })

      it("refuses a successor that is the product, unknown, or loops back", async () => {
        const first = await createProduct(product("Eski Model"))
        const second = await createProduct(product("Yeni Model"))

        const self = await setCatalog(first.id, { successor_product_id: first.id })
        const unknown = await setCatalog(first.id, { successor_product_id: "prod_unknown" })
        const forward = await setCatalog(first.id, { successor_product_id: second.id })
        const loop = await setCatalog(second.id, { successor_product_id: first.id })

        expect(self.data.message).toBe("catalog.successor_self")
        expect(unknown.data.message).toBe("catalog.successor_unknown")
        expect(forward.status).toBe(200)
        expect(forward.data.successor).toEqual({
          id: second.id,
          title: "Yeni Model",
          handle: "yeni-model",
        })
        expect(loop.status).toBe(400)
        expect(loop.data.message).toBe("catalog.successor_loop")
      })

      it("reads a primary category the product no longer has as unset", async () => {
        const knives = await category("Bıçaklar")
        const created = await createProduct(
          product("Oyma Bıçağı", { categories: [{ id: knives }] })
        )
        await setCatalog(created.id, { primary_category_id: knives })

        await post(`/admin/products/${created.id}`, { categories: [] })
        const after = await http.get<Catalog>(`/admin/products/${created.id}/catalog`, {
          headers: admin.headers,
        })

        expect(after.data.primary_category_id).toBeNull()
      })

      it("answers 404 for an unknown product", async () => {
        const missing = await settle(
          http.get(`/admin/products/prod_unknown/catalog`, { headers: admin.headers })
        )

        expect(missing.status).toBe(404)
      })

      it("finds a successor loop through a longer chain", async () => {
        const [a, b, c] = [
          await createProduct(product("Model A")),
          await createProduct(product("Model B")),
          await createProduct(product("Model C")),
        ]

        await setCatalog(a.id, { successor_product_id: b.id })
        await setCatalog(b.id, { successor_product_id: c.id })
        const loop = await setCatalog(c.id, { successor_product_id: a.id })

        expect(loop.status).toBe(400)
        expect(loop.data.message).toBe("catalog.successor_loop")
      })

      it("refuses another product's variant and a control character in an MPN", async () => {
        const mine = await createProduct(product("Bıçak Seti"))
        const theirs = await createProduct(product("Bileği Taşı"))

        const foreign = await setCatalog(mine.id, {
          variants: { [theirs.variants[0]?.id ?? ""]: { mpn: "X-1" } },
        })
        const control = await setCatalog(mine.id, {
          variants: { [mine.variants[0]?.id ?? ""]: { mpn: "X\u00071" } },
        })
        const unknownField = await setCatalog(mine.id, { kind: "digital" })

        expect(foreign.status).toBe(400)
        expect(foreign.data.message).toBe("catalog.variant_unknown")
        expect(control.status).toBe(400)
        expect(unknownField.status).toBe(400)
      })

      it("records the change in the audit log with its before and after", async () => {
        const created = await createProduct(product("Soyma Bıçağı"))

        await setCatalog(created.id, { condition: "used" })
        let diff = ""
        for (let attempt = 0; attempt < 30 && !diff; attempt++) {
          const { data } = await http.get<{ audit_entries: { changes?: { diff?: unknown } }[] }>(
            `/admin/audit-log?resource_id=${created.id}&kind=mutation`,
            { headers: admin.headers }
          )
          diff = data.audit_entries[0] ? JSON.stringify(data.audit_entries[0].changes?.diff) : ""
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        expect(diff).toContain('"before":"new"')
        expect(diff).toContain('"after":"used"')
      })
    })
  },
})

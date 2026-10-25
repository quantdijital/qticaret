import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Brand {
  id: string
  name: string
  handle: string
  is_active: boolean
  product_count: number
}

interface Answer {
  type: string
  status?: number
  location?: string
  entity_type?: string
  seo?: { title: string } | null
}

const product = (title: string) => ({
  title,
  status: "published",
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
})

/** F3.11: brands, their pages and paths, a product's brand, the Store API. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const createBrand = async (body: Record<string, unknown>) =>
      post<{ brand: Brand }>("/admin/brands", body)
    const resolve = async (path: string) =>
      (
        await http.get<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    it("makes a brand with a Turkish name a slug page with its own SEO title", async () => {
      const created = await createBrand({ name: "Örnek Çelik", description: "Bıçak üreticisi." })
      expect(created.status).toBe(201)
      expect(created.data.brand).toMatchObject({ handle: "ornek-celik", is_active: true })

      const answer = await resolve("/marka/ornek-celik")
      expect(answer).toMatchObject({ type: "entity", entity_type: "brand" })
      expect(answer.seo?.title.startsWith("Örnek Çelik Ürünleri |")).toBe(true)

      const twice = await createBrand({ name: "örnek ÇELİK" })
      const badLogo = await createBrand({ name: "Başka", logo_file_id: "file_01NOPE" })
      expect(twice.status).toBe(409)
      expect(twice.data.message).toBe("brands.name_taken")
      expect(badLogo.data.message).toBe("brands.logo_unknown")
    })

    it("gives products a brand the Store API shows and the product title uses", async () => {
      const brand = (await createBrand({ name: "Örnek Çelik" })).data.brand
      const { data } = await post<{ product: { id: string } }>(
        "/admin/products",
        product("Şef Bıçağı")
      )
      const set = await post<{ brand: { name: string } }>(
        `/admin/products/${data.product.id}/brand`,
        { brand_id: brand.id }
      )
      expect(set.data.brand.name).toBe("Örnek Çelik")

      const listed = await storeGet<{ products: { brand?: { name: string } }[] }>(
        "/store/products?fields=id,brand.name,brand.handle"
      )
      expect(listed.data.products[0]?.brand?.name).toBe("Örnek Çelik")
      expect((await resolve("/urun/sef-bicagi")).seo?.title).toContain("Şef Bıçağı | Örnek Çelik |")

      const ids = await storeGet<{ product_ids: string[]; count: number }>(
        `/store/brands/${brand.id}/products`
      )
      expect(ids.data).toMatchObject({ product_ids: [data.product.id], count: 1 })
      const { data: counted } = await http.get<{ brands: Brand[] }>("/admin/brands", {
        headers: admin.headers,
      })
      expect(counted.brands[0]?.product_count).toBe(1)

      await post(`/admin/products/${data.product.id}/brand`, { brand_id: null })
      expect((await resolve("/urun/sef-bicagi")).seo?.title).not.toContain("Örnek Çelik")
    })

    it("sends a renamed brand's old path on, hides an inactive one, and answers 410 once deleted", async () => {
      const brand = (await createBrand({ name: "Örnek Çelik" })).data.brand
      await post(`/admin/brands/${brand.id}`, { handle: "ornek-celik-tr" })
      expect(await resolve("/marka/ornek-celik")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/marka/ornek-celik-tr",
      })

      await post(`/admin/brands/${brand.id}`, { is_active: false })
      expect(await resolve("/marka/ornek-celik-tr")).toMatchObject({ type: "not_found" })
      expect((await storeGet(`/store/brands/${brand.id}`)).status).toBe(404)
      const { data } = await storeGet<{ brands: Brand[] }>("/store/brands")
      expect(data.brands).toHaveLength(0)

      await http.delete(`/admin/brands/${brand.id}`, { headers: admin.headers })
      expect(await resolve("/marka/ornek-celik-tr")).toMatchObject({ type: "gone" })
    })

    it("keeps a brand page's own SEO fields", async () => {
      const brand = (await createBrand({ name: "Örnek Çelik" })).data.brand
      const saved = await settle(
        http.put(
          `/admin/seo/brand/${brand.id}`,
          { seo_title: "Örnek Çelik Bıçakları" },
          { headers: admin.headers }
        )
      )
      expect(saved.status).toBe(200)
      expect((await resolve("/marka/ornek-celik")).seo?.title).toBe("Örnek Çelik Bıçakları")
    })
  },
})

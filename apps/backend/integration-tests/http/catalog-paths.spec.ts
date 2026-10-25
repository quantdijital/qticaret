import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { URL_REGISTRY_MODULE } from "../../src/modules/url-registry"
import type UrlRegistryModuleService from "../../src/modules/url-registry/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Record_ {
  id: string
  handle: string
}

// A draft needs no weight or dimensions
const draft = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  status: "draft",
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

const published = (title: string, extra: Record<string, unknown> = {}) =>
  draft(title, { status: "published", weight: 250, length: 30, width: 5, height: 2, ...extra })

/** F3.1: Turkish handles and the storefront paths products and collections own (docs/13 §2). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const registry = () => getContainer().resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    const pathOf = (path: string) => registry().resolvePath({ locale: "tr", path })
    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const createProduct = async (body: unknown) =>
      (await post<{ product: Record_ }>("/admin/products", body)).data.product

    // The settings cache outlives the database reset between tests: always set back
    async function withStyle(product: string, category: string, run: () => Promise<void>) {
      const style = (p: string, c: string) =>
        post("/admin/platform-settings/seo", {
          url_style: { product: p, category: c, brand: "prefixed" },
        })
      await style(product, category)
      try {
        await run()
      } finally {
        await style("prefixed", "prefixed")
      }
    }

    // The release runs in a subscriber, after the delete answers
    async function settledPath(path: string, until: (status: string | undefined) => boolean) {
      let status: string | undefined
      for (let attempt = 0; attempt < 30; attempt++) {
        status = (await pathOf(path))?.status
        if (until(status)) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      return status
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("makes a Turkish title into an ASCII handle and gives the product its path", async () => {
      const product = await createProduct(draft("Şef Bıçağı 20 cm"))

      expect(product.handle).toBe("sef-bicagi-20-cm")
      expect(await pathOf("/urun/sef-bicagi-20-cm")).toEqual({
        entity_type: "product",
        entity_id: product.id,
        status: "active",
      })
    })

    it("refuses a handle that is not a slug, and one the title cannot give", async () => {
      const turkish = await post("/admin/products", draft("Şef Bıçağı", { handle: "şef-bıçağı" }))
      const digits = await post("/admin/products", draft("2024"))

      expect(turkish.status).toBe(400)
      expect(turkish.data.message).toBe("catalog.handle_invalid")
      expect(digits.status).toBe(400)
      expect(digits.data.message).toBe("catalog.handle_required")
    })

    it("keeps a published product's old path reserved when its handle changes", async () => {
      const product = await createProduct(published("Kupa", { handle: "kupa" }))

      const renamed = await post(`/admin/products/${product.id}`, { handle: "seramik-kupa" })

      expect(renamed.status).toBe(200)
      expect(await pathOf("/urun/seramik-kupa")).toMatchObject({ status: "active" })
      expect(await pathOf("/urun/kupa")).toEqual({
        entity_type: "product",
        entity_id: product.id,
        status: "reserved",
      })
    })

    it("gives a draft's old path up when its handle changes, for another product", async () => {
      const product = await createProduct(draft("Tabak", { handle: "tabak" }))

      await post(`/admin/products/${product.id}`, { handle: "porselen-tabak" })
      const other = await post<{ product: Record_ }>("/admin/products", draft("Tabak"))

      expect(other.status).toBe(200)
      expect(await pathOf("/urun/tabak")).toMatchObject({ entity_id: other.data.product.id })
    })

    it("refuses a path a category holds in the flat style, and undoes the product", async () => {
      await withStyle("flat", "flat", async () => {
        const category = await post<{ product_category: Record_ }>("/admin/product-categories", {
          name: "Bıçak",
          is_active: true,
        })
        const product = await post("/admin/products", draft("Bıçak"))
        const left = await http.get<{ count: number }>("/admin/products?handle=bicak", {
          headers: admin.headers,
        })

        expect(await pathOf("/bicak")).toMatchObject({
          entity_id: category.data.product_category.id,
        })
        expect(product.status).toBe(400)
        expect(product.data.message).toBe("seo.path_taken")
        expect(left.data.count).toBe(0)
      })
    })

    it("refuses a root path the storefront keeps, in the flat style", async () => {
      await withStyle("flat", "prefixed", async () => {
        const product = await post("/admin/products", draft("Sepet"))

        expect(product.status).toBe(400)
        expect(product.data.message).toBe("seo.path_reserved")
      })
    })

    it("does not block an unrelated edit after the URL style changes", async () => {
      const product = await createProduct(draft("Sepet Çantası", { handle: "sepet" }))

      await withStyle("flat", "prefixed", async () => {
        const edited = await post(`/admin/products/${product.id}`, { title: "Hasır Sepet" })

        expect(edited.status).toBe(200)
        expect(await pathOf("/urun/sepet")).toMatchObject({ status: "active" })
      })
    })

    it("gives a collection its path under /koleksiyon", async () => {
      const created = await post<{ collection: Record_ }>("/admin/collections", {
        title: "Yaz İndirimi",
      })

      expect(created.data.collection.handle).toBe("yaz-indirimi")
      expect(await pathOf("/koleksiyon/yaz-indirimi")).toMatchObject({
        entity_type: "product_collection",
        entity_id: created.data.collection.id,
      })
    })

    it("fills the handles of products created in a batch", async () => {
      const batch = await post<{ created: Record_[] }>("/admin/products/batch", {
        create: [draft("Ekmek Bıçağı")],
      })

      expect(batch.status).toBe(200)
      expect(batch.data.created[0]?.handle).toBe("ekmek-bicagi")
      expect(await pathOf("/urun/ekmek-bicagi")).toMatchObject({ status: "active" })
    })

    it("keeps a deleted published product's path reserved, so no other record takes it", async () => {
      const product = await createProduct(published("Satır"))

      await http.delete(`/admin/products/${product.id}`, { headers: admin.headers })
      const status = await settledPath("/urun/satir", (current) => current === "reserved")
      const again = await post("/admin/products", draft("Satır"))

      expect(status).toBe("reserved")
      expect(again.status).toBe(400)
      expect(again.data.message).toBe("seo.path_taken")
    })

    it("frees a deleted draft's path, so the name can be used again", async () => {
      const product = await createProduct(draft("Çatal"))

      await http.delete(`/admin/products/${product.id}`, { headers: admin.headers })
      const status = await settledPath("/urun/catal", (current) => current === undefined)
      const again = await post("/admin/products", draft("Çatal"))

      expect(status).toBeUndefined()
      expect(again.status).toBe(200)
    })
  },
})

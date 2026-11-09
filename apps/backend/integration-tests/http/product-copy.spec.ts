import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WorkflowResponse, createStep, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { duplicateProductWorkflow } from "../../src/workflows/catalog/duplicate/workflow"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface Variant {
  id: string
  title: string
  sku: string | null
  ean: string | null
  prices: { amount: number; currency_code: string }[]
}

interface Product {
  id: string
  title: string
  handle: string
  status: string
  description: string | null
  images: { url: string }[]
  categories: { id: string }[]
  variants: Variant[]
}

interface Catalog {
  condition: string
  variants: { id: string; title: string; mpn: string | null; cost: number | null }[]
}

const FIELDS =
  "id,title,handle,status,description,images.url,categories.id," +
  "variants.id,variants.title,variants.sku,variants.ean,variants.prices.amount,variants.prices.currency_code"

// A test-only workflow that fails right after a copy, to run the copy's compensation
const forcedFailureStep = createStep("test-product-copy-forced-failure", async () => {
  await Promise.resolve()
  throw new Error("forced failure")
})
const copyThenFail = createWorkflow(
  "test-product-copy-then-fail",
  (input: { product_id: string }) => {
    duplicateProductWorkflow.runAsStep({ input })
    forcedFailureStep()
    return new WorkflowResponse(undefined)
  }
)

/** "Kopyala" and "Vitrinde gör / Önizle" on a product (owner 2026-11-06). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    const post = <T>(url: string, body: unknown = {}) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const read = async (id: string) =>
      (
        await http.get<{ product: Product }>(`/admin/products/${id}?fields=${FIELDS}`, {
          headers: admin.headers,
        })
      ).data.product
    const catalog = async (id: string) =>
      (await http.get<Catalog>(`/admin/products/${id}/catalog`, { headers: admin.headers })).data

    async function source(status: "published" | "draft" = "published"): Promise<Product> {
      const knives = (
        await post<{ product_category: { id: string } }>("/admin/product-categories", {
          name: "Bıçaklar",
          is_active: true,
        })
      ).data.product_category.id
      const { data } = await post<{ product: Product }>("/admin/products", {
        title: "Şef Bıçağı",
        status,
        description: "Paslanmaz çelik.",
        thumbnail: "https://cdn.example/a.jpg",
        images: [{ url: "https://cdn.example/a.jpg" }, { url: "https://cdn.example/b.jpg" }],
        categories: [{ id: knives }],
        sales_channels: [{ id: store.salesChannelId }],
        options: [{ title: "Boyut", values: ["20 cm", "25 cm"] }],
        variants: ["20 cm", "25 cm"].map((size, index) => ({
          title: size,
          sku: `SEF-${String(index)}`,
          ean: index === 0 ? "4006381333931" : undefined,
          options: { Boyut: size },
          manage_inventory: false,
          prices: [{ currency_code: "try", amount: 1000 + index * 500 }],
        })),
      })
      return read(data.product.id)
    }

    it("copies a product as a draft on a free address, codes left empty, the rest carried", async () => {
      const original = await source()
      const brand = (await post<{ brand: { id: string } }>("/admin/brands", { name: "Örnek" })).data
        .brand
      await post(`/admin/products/${original.id}/brand`, { brand_id: brand.id })
      const seo = await settle(
        http.put(
          `/admin/seo/product/${original.id}`,
          { seo_title: "Şef bıçağı al", canonical_override: "/urun/sef-bicagi" },
          { headers: admin.headers }
        )
      )
      expect(seo.status).toBe(200)
      const first = original.variants.find((variant) => variant.title === "20 cm")
      await post(`/admin/products/${original.id}/catalog`, {
        condition: "used",
        variants: { [first?.id ?? ""]: { mpn: "SB-20", cost: 400.5 } },
      })

      const copied = await post<{ product: { id: string; handle: string; title: string } }>(
        `/admin/products/${original.id}/duplicate`
      )
      expect(copied.status).toBe(201)
      expect(copied.data.product).toMatchObject({
        handle: "sef-bicagi-kopya",
        title: "Şef Bıçağı (kopya)",
      })

      const copy = await read(copied.data.product.id)
      expect(copy).toMatchObject({ status: "draft", description: "Paslanmaz çelik." })
      expect(copy.images.map((image) => image.url).sort()).toEqual([
        "https://cdn.example/a.jpg",
        "https://cdn.example/b.jpg",
      ])
      expect(copy.categories).toEqual(original.categories)
      const prices = (product: Product) =>
        Object.fromEntries(
          product.variants.map((variant) => [variant.title, variant.prices[0]?.amount])
        )
      expect(prices(copy)).toEqual(prices(original))
      for (const variant of copy.variants) {
        expect(variant).toMatchObject({ sku: null, ean: null })
      }

      const copiedCatalog = await catalog(copy.id)
      expect(copiedCatalog.condition).toBe("used")
      const copiedFirst = copiedCatalog.variants.find((variant) => variant.title === "20 cm")
      const sourceFirst = (await catalog(original.id)).variants.find(
        (variant) => variant.title === "20 cm"
      )
      expect(copiedFirst?.mpn).toBeNull()
      expect(copiedFirst?.cost).toBe(sourceFirst?.cost)

      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: ["brand.id", "seo_meta.seo_title", "seo_meta.canonical_override"],
          filters: { id: copy.id },
        })
      expect(data[0]).toMatchObject({
        brand: { id: brand.id },
        seo_meta: { seo_title: "Şef bıçağı al", canonical_override: null },
      })

      // A second copy takes the next free address
      const again = await post<{ product: { handle: string } }>(
        `/admin/products/${original.id}/duplicate`
      )
      expect(again.data.product.handle).toBe("sef-bicagi-kopya-2")

      // Recorded under the product copied
      let actions: string[] = []
      for (let attempt = 0; attempt < 30 && actions.length === 0; attempt++) {
        const { data: log } = await http.get<{ audit_entries: { action: string }[] }>(
          `/admin/audit-log?resource_id=${original.id}&kind=mutation`,
          { headers: admin.headers }
        )
        actions = log.audit_entries.map((entry) => entry.action)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(actions).toContain("POST /admin/products/:id/duplicate")

      expect((await post(`/admin/products/prod_nope/duplicate`)).status).toBe(404)
    })

    it("leaves nothing of a copy when a later step fails", async () => {
      const original = await source()
      const container = getContainer()

      const { errors } = await copyThenFail(container).run({
        input: { product_id: original.id },
        throwOnError: false,
      })

      expect(errors.length).toBeGreaterThan(0)
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product",
        fields: ["id", "handle"],
      })
      expect((data as { handle: string }[]).map((row) => row.handle)).toEqual(["sef-bicagi"])
      // Its address is free again: the next copy takes it
      const copied = await post<{ product: { handle: string } }>(
        `/admin/products/${original.id}/duplicate`
      )
      expect(copied.data.product.handle).toBe("sef-bicagi-kopya")
    })

    it("opens a published product's own page and a draft's signed, unindexed preview", async () => {
      const live = await source()
      // The lira region the preview prices in
      await post("/admin/regions", { name: "Türkiye", currency_code: "try", countries: ["tr"] })
      const shown = await post<{ live: boolean; path: string }>(
        `/admin/products/${live.id}/preview`
      )
      expect(shown.data).toMatchObject({ live: true, path: "/urun/sef-bicagi" })

      const draft = (
        await post<{ product: { id: string } }>(`/admin/products/${live.id}/duplicate`)
      ).data.product
      const link = await post<{ live: boolean; path: string; expires_at: string }>(
        `/admin/products/${draft.id}/preview`
      )
      expect(link.data.live).toBe(false)
      expect(link.data.path).toMatch(/^\/onizleme\/prod_[0-9A-Za-z]+\.[0-9a-z]+\.[\w-]{43}$/)
      const token = link.data.path.split("/").at(-1) ?? ""

      const page = await settle(
        http.get<{
          product: {
            title: string
            variants: { title: string; calculated_price?: { calculated_amount: number } }[]
          }
          texts: { html: string | null }
        }>(`/store/product-preview/${token}`, { headers: store.headers })
      )
      expect(page.status).toBe(200)
      expect(page.data.product.title).toBe("Şef Bıçağı (kopya)")
      const amounts = Object.fromEntries(
        page.data.product.variants.map((variant) => [
          variant.title,
          variant.calculated_price?.calculated_amount,
        ])
      )
      expect(amounts).toEqual({ "20 cm": 1000, "25 cm": 1500 })
      expect(page.data.texts).toMatchObject({ html: null })
      expect(page.headers["x-robots-tag"]).toBe("noindex, nofollow")
      expect(page.headers["cache-control"]).toBe("no-store")
      // The draft itself is nobody's: Medusa's store answer does not have it
      const hidden = await settle(
        http.get(`/store/products/${draft.id}`, { headers: store.headers })
      )
      expect(hidden.status).toBe(404)

      const forged = await settle(
        http.get(`/store/product-preview/${token.slice(0, -2)}xx`, { headers: store.headers })
      )
      expect(forged.status).toBe(404)
      // A later save ends the link
      await post(`/admin/products/${draft.id}`, { subtitle: "Yeni" })
      const stale = await settle(
        http.get(`/store/product-preview/${token}`, { headers: store.headers })
      )
      expect(stale.status).toBe(404)
    })
  },
})

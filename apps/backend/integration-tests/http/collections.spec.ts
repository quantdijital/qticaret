import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import sharp from "sharp"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { buildSitemap } from "../../src/workflows/seo/sitemap-build"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Collection {
  id: string
  title: string
  handle: string
  description: string | null
  is_active: boolean
  image: { url: string; alt: string | null } | null
  product_count: number
}

interface Answer {
  type: string
  status?: number
  location?: string
  entity_type?: string
  entity_id?: string
  seo?: { description: string } | null
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

/** Ürünler > Koleksiyonlar: a collection's page, text, picture, visibility and products. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const adminGet = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))
    const resolve = async (path: string) =>
      (
        await http.get<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data
    const createCollection = async (title: string) =>
      (await post<{ collection: Collection }>("/admin/collections", { title })).data.collection
    const createProduct = async (title: string) =>
      (await post<{ product: { id: string } }>("/admin/products", product(title))).data.product.id
    const board = async (id: string) =>
      (await adminGet<{ collection: Collection }>(`/admin/collection-board/${id}`)).data.collection
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    async function libraryImage(): Promise<{ id: string; url: string }> {
      const bytes = await sharp({
        create: { width: 64, height: 48, channels: 3, background: { r: 120, g: 60, b: 20 } },
      })
        .png()
        .toBuffer()
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "yaz.png")
      const { data: uploaded } = await http.post<{ files: { id: string }[] }>(
        "/admin/uploads",
        form,
        admin
      )
      const registered = await post<{ media: { id: string; url: string }[] }>("/admin/media", {
        file_ids: uploaded.files.map((file) => file.id),
        library: true,
      })
      const media = registered.data.media[0]
      if (!media) {
        throw new Error("no media registered")
      }
      return media
    }

    // Mutations are written once the response has finished, so they may land a moment after it
    const auditEntries = (resourceId: string) =>
      eventually(
        async () =>
          (
            await http.get<{
              audit_entries: { action: string; changes: { diff?: unknown } | null }[]
            }>(`/admin/audit-log?resource_id=${resourceId}&kind=mutation`, {
              headers: admin.headers,
            })
          ).data.audit_entries,
        (found) => found.some((entry) => entry.action === "POST /admin/collections/:id/details")
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    // The settings cache outlives the database reset between tests: always set back
    afterEach(async () => {
      await settings().saveSection("seo", { canonical_host: null }, null)
    })

    it("saves a collection's text, picture and visibility, and shows them on its page", async () => {
      const collection = await createCollection("Yaz Seçkisi")
      const media = await libraryImage()
      const image = media.url

      const outside = await post(`/admin/collections/${collection.id}/details`, {
        image: { url: "https://baska.example/resim.png", alt: null },
      })
      const unknown = await post("/admin/collections/pcol_yok/details", { is_active: false })
      const saved = await post<{ collection: Collection }>(
        `/admin/collections/${collection.id}/details`,
        {
          description: "Yazın en sevilen bıçakları.\n\nHafif ve keskin.",
          image: { url: image, alt: "Yaz seçkisi" },
        }
      )
      const details = await storeGet<{
        details: { description: string | null; image: { url: string; alt: string | null } | null }
      }>(`/store/collections/${collection.id}/details`)
      const page = await resolve("/koleksiyon/yaz-seckisi")

      expect(outside.status).toBe(400)
      expect(outside.data.message).toBe("catalog.collection_image_unknown")
      expect(unknown.status).toBe(404)
      expect(saved.status).toBe(200)
      expect(saved.data.collection).toMatchObject({
        handle: "yaz-seckisi",
        description: "Yazın en sevilen bıçakları.\n\nHafif ve keskin.",
        is_active: true,
        image: { url: image, alt: "Yaz seçkisi" },
        product_count: 0,
      })
      expect(details.data.details).toMatchObject({
        description: "Yazın en sevilen bıçakları.\n\nHafif ve keskin.",
        image: { url: image, alt: "Yaz seçkisi", width: 64, height: 48 },
      })
      expect(page).toMatchObject({ type: "entity", entity_type: "product_collection" })
      // Its text is the meta description's fallback
      expect(page.seo?.description).toContain("Yazın en sevilen bıçakları.")

      // The picture is in use: the library names the collection and keeps the file
      const usage = await adminGet<{ media: { usage: { kind: string; id: string | null }[] } }>(
        `/admin/media/${media.id}`
      )
      expect(usage.data.media.usage).toEqual(
        expect.arrayContaining([{ kind: "collection", id: collection.id, label: "Yaz Seçkisi" }])
      )
      // The audit log keeps what changed, before and after
      const [entry] = await auditEntries(collection.id)
      expect(JSON.stringify(entry?.changes?.diff)).toContain(image)

      // A field left out keeps its value
      await post(`/admin/collections/${collection.id}/details`, { is_active: false })
      const hidden = await board(collection.id)
      expect(hidden).toMatchObject({ is_active: false, image: { url: image } })
      expect(await resolve("/koleksiyon/yaz-seckisi")).toMatchObject({ type: "not_found" })
      expect((await storeGet(`/store/collections/${collection.id}/details`)).status).toBe(404)

      await post(`/admin/collections/${collection.id}/details`, { is_active: true, image: null })
      expect(await board(collection.id)).toMatchObject({ is_active: true, image: null })
      expect(await resolve("/koleksiyon/yaz-seckisi")).toMatchObject({ type: "entity" })
    })

    it("lists collections with their product counts, adds and removes products", async () => {
      const summer = await createCollection("Yaz Seçkisi")
      await createCollection("Kış Seçkisi")
      const first = await createProduct("Şef Bıçağı")
      const second = await createProduct("Ekmek Bıçağı")

      const added = await post(`/admin/collections/${summer.id}/products`, {
        add: [first, second],
      })
      const listed = await adminGet<{ collections: Collection[]; count: number }>(
        "/admin/collection-board?q=yaz"
      )
      const all = await adminGet<{ collections: Collection[]; count: number }>(
        "/admin/collection-board"
      )
      expect(added.status).toBe(200)
      expect(listed.data.count).toBe(1)
      expect(listed.data.collections[0]).toMatchObject({ id: summer.id, product_count: 2 })
      expect(all.data.collections.map((each) => each.title)).toEqual(["Kış Seçkisi", "Yaz Seçkisi"])

      await post(`/admin/collections/${summer.id}/products`, { remove: [second] })
      // The product page's own field: Medusa's product update
      const moved = await post<{ product: { collection_id: string | null } }>(
        `/admin/products/${second}`,
        { collection_id: summer.id }
      )
      expect(moved.data.product.collection_id).toBe(summer.id)
      await post(`/admin/products/${first}`, { collection_id: null })
      expect((await board(summer.id)).product_count).toBe(1)
    })

    it("sends a renamed collection's old path on and answers 410 once deleted, keeping its products", async () => {
      const collection = await createCollection("Yaz Seçkisi")
      const kept = await createProduct("Şef Bıçağı")
      await post(`/admin/collections/${collection.id}/products`, { add: [kept] })
      await post(`/admin/collections/${collection.id}/details`, { description: "Yaz." })

      const renamed = await post(`/admin/collections/${collection.id}`, { handle: "yaz-2026" })
      const bad = await post(`/admin/collections/${collection.id}`, { handle: "Yaz Seçkisi" })
      expect(renamed.status).toBe(200)
      expect(bad.status).toBe(400)
      expect(await resolve("/koleksiyon/yaz-seckisi")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/koleksiyon/yaz-2026",
      })

      const deleted = await settle(
        http.delete(`/admin/collections/${collection.id}`, { headers: admin.headers })
      )
      expect(deleted.status).toBe(200)
      // The release runs in a subscriber, after the delete answers
      const gone = await eventually(
        () => resolve("/koleksiyon/yaz-2026"),
        (answer) => answer.type === "gone"
      )
      expect(gone).toMatchObject({ type: "gone" })
      const products = getContainer().resolve(Modules.PRODUCT)
      const [still] = await products.listProducts({ id: kept }, { select: ["id", "collection_id"] })
      expect(still).toMatchObject({ id: kept, collection_id: null })
      expect((await adminGet(`/admin/collection-board/${collection.id}`)).status).toBe(404)
    })

    it("lists shown collections in the sitemap and leaves hidden ones out", async () => {
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const shown = await createCollection("Yaz Seçkisi")
      const hidden = await createCollection("Arşiv")
      const item = await createProduct("Şef Bıçağı")
      await post(`/admin/collections/${shown.id}/products`, { add: [item] })
      await post(`/admin/collections/${hidden.id}/details`, { is_active: false })

      const built = await buildSitemap(getContainer())
      const collections = built?.files.find((file) => file.name.includes("collections"))

      expect(collections?.content).toContain("https://magaza.example.com/koleksiyon/yaz-seckisi")
      expect(collections?.content).not.toContain("/koleksiyon/arsiv")
    })
  },
})

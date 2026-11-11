import { existsSync, rmSync } from "node:fs"
import { basename } from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { createAdminUser } from "../helpers/admin"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import mediaSweep from "../../src/jobs/media-sweep"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)

interface Version {
  width: number
  url: string
}

interface Media {
  id: string
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: {
    srcset: { webp: Version[]; avif: Version[] }
    og: { url: string; width: number; height: number } | null
  } | null
}

const product = (handle: string, images: string[]) => ({
  title: "Keten Gömlek",
  handle,
  status: "published",
  weight: 250,
  length: 30,
  width: 5,
  height: 2,
  images: images.map((url) => ({ url })),
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

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 80 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "Phone" } })
    .toBuffer()

const storedPath = (url: string) => filesNamed(new RegExp(`^${basename(url)}$`))[0]

// Rows are made now; the sweep looks for ones a day old
async function setCreatedAt(container: MedusaContainer, ids: string[], at: Date) {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  await knex("media_asset").whereIn("id", ids).update({ created_at: at })
}

/** F3.3 (adr/0016): product images with alt text and versions named after the product. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))

    async function uploaded(...images: Buffer[]): Promise<{ id: string; url: string }[]> {
      const form = new FormData()
      images.forEach((image, index) => {
        form.append(
          "files",
          new Blob([new Uint8Array(image)], { type: "image/jpeg" }),
          `foto-${String(index)}.jpg`
        )
      })
      const { data } = await http.post<{ files: { id: string; url: string }[] }>(
        "/admin/uploads",
        form,
        admin
      )
      return data.files
    }

    async function mediaOf(productId: string, until: (media: Media[]) => boolean) {
      let media: Media[] = []
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ product: { media_assets: Media[] } }>(
          `/admin/products/${productId}?fields=id,*media_assets`,
          admin
        )
        media = data.product.media_assets
        if (until(media)) {
          return media
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error(`media never settled: ${JSON.stringify(media)}`)
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    afterAll(() => {
      for (const path of filesNamed(/(keten|yaz|foto)-/)) {
        rmSync(path, { force: true })
      }
    })

    it("makes versions named after the product, and makes them again when it moves", async () => {
      const files = await uploaded(await photo(1000, 800), await photo(600, 600))
      const registered = await post<{ media: { id: string; width: number }[] }>("/admin/media", {
        file_ids: files.map((file) => file.id),
      })
      expect(registered.status).toBe(200)
      expect(registered.data.media.map((media) => media.width)).toEqual([1000, 600])

      const created = await post<{ product: { id: string } }>(
        "/admin/products",
        product(
          "keten-gomlek",
          files.map((file) => file.url)
        )
      )
      const id = created.data.product.id
      const first = await mediaOf(
        id,
        (media) => media.length === 2 && media.every((each) => each.derivatives)
      )
      const main = first.find((media) => media.url === files[0]?.url)
      expect(main?.derivatives?.srcset.webp.map((version) => version.width)).toEqual([
        400, 800, 1000,
      ])
      expect(main?.derivatives?.srcset.avif).toHaveLength(3)
      expect(main?.derivatives?.og).toMatchObject({ width: 1200, height: 630 })
      expect(basename(main?.derivatives?.og?.url ?? "")).toContain("keten-gomlek-1-og")
      const oldOg = main?.derivatives?.og?.url ?? ""
      expect(existsSync(storedPath(oldOg) ?? "")).toBe(true)

      // A new slug renames the versions; the old files go
      await post(`/admin/products/${id}`, { handle: "yaz-gomlegi" })
      const moved = await mediaOf(id, (media) =>
        media.every((each) => basename(each.derivatives?.og?.url ?? "").includes("yaz-gomlegi-"))
      )
      expect(moved.map((each) => basename(each.derivatives?.og?.url ?? "")).sort()).toEqual([
        expect.stringContaining("yaz-gomlegi-1-og"),
        expect.stringContaining("yaz-gomlegi-2-og"),
      ])
      expect(storedPath(oldOg)).toBeUndefined()

      // An image the product drops leaves it
      await post(`/admin/products/${id}`, { images: [{ url: files[1]?.url }] })
      await mediaOf(id, (media) => media.length === 1 && media[0]?.url === files[1]?.url)
    })

    it("keeps an image's alt text and shows the storefront what it needs", async () => {
      const [file] = await uploaded(await photo(800, 800))
      const registered = await post<{ media: { id: string }[] }>("/admin/media", {
        file_ids: [file?.id],
      })
      const mediaId = registered.data.media[0]?.id ?? ""
      const created = await post<{ product: { id: string } }>(
        "/admin/products",
        product("keten-kupa", [file?.url ?? ""])
      )
      await mediaOf(created.data.product.id, (media) => Boolean(media[0]?.derivatives))

      const issues = async () =>
        (
          await http.get<{ assessment: { issues: { ruleId: string }[] } }>(
            `/admin/seo/assessments/product/${created.data.product.id}`,
            admin
          )
        ).data.assessment.issues.map(({ ruleId }) => ruleId)
      // No alt text yet: the advisor asks for one
      expect(await issues()).toContain("P-IMG-02")

      const saved = await post(`/admin/media/${mediaId}`, { alt: "  Beyaz keten gömlek, önden  " })
      expect(saved.status).toBe(200)
      const store = await createStorefront(getContainer())
      const { data } = await http.get<{ products: { media_assets: Record<string, unknown>[] }[] }>(
        "/store/products?handle=keten-kupa&fields=id,+media_assets.url,+media_assets.alt,+media_assets.derivatives",
        { headers: store.headers }
      )
      expect(data.products[0]?.media_assets[0]).toMatchObject({
        alt: "Beyaz keten gömlek, önden",
        url: file?.url,
        derivatives: { og: { width: 1200 } },
      })
      // Storage keys and bookkeeping stay inside
      expect(data.products[0]?.media_assets[0]).not.toHaveProperty("file_id")
      expect(data.products[0]?.media_assets[0]).not.toHaveProperty("derivative_file_ids")

      expect(await issues()).not.toContain("P-IMG-02")
      // The share image is the main image's crop, with its alt text
      const { data: resolved } = await http.get<{
        seo: { openGraph: { image: string | null; imageAlt: string | null } }
      }>(`/store/seo/resolve?path=${encodeURIComponent("/urun/keten-kupa")}`, {
        headers: store.headers,
      })
      expect(resolved.seo.openGraph.image).toContain("keten-kupa-1-og")
      expect(resolved.seo.openGraph.imageAlt).toBe("Beyaz keten gömlek, önden")

      // Every column at once would show storage keys: refused
      const everything = await settle(
        http.get("/store/products?handle=keten-kupa&fields=id,*media_assets", {
          headers: store.headers,
        })
      )
      expect(everything.status).toBe(400)

      expect((await post(`/admin/media/${mediaId}`, { alt: "" })).status).toBe(200)
      expect((await post(`/admin/media/${mediaId}`, { alt: "satır\nsonu" })).status).toBe(400)
    })

    it("takes only images the shop uploaded", async () => {
      const unknown = await post<{ message: string }>("/admin/media", { file_ids: ["yok.jpg"] })
      expect(unknown.status).toBe(404)
      expect(unknown.data.message).toBe("media.file_unknown")

      // adr/0061 Ek C14 review M4: a CSV is not even stored any more (images only)
      const form = new FormData()
      form.append("files", new Blob(["sku;ad\n1;Kupa\n"], { type: "text/csv" }), "urunler.csv")
      const csv = await post<{ message: string }>("/admin/uploads", form)
      expect(csv.status).toBe(400)
      expect(csv.data.message).toBe("upload.unsupported_type")

      // A key that would leave the storage folder is not even looked up
      const escape = await post<{ message: string }>("/admin/media", {
        file_ids: ["../../etc/hosts"],
      })
      expect(escape.status).toBe(400)
    })

    it("gives an image added by its URL a record for its alt text, and counts the shop's missing ones", async () => {
      const created = await post<{ product: { id: string } }>(
        "/admin/products",
        product("keten-sal", ["https://cdn.example.com/keten-sal.jpg"])
      )
      const id = created.data.product.id
      const [record] = await mediaOf(id, (media) => media.length === 1)
      expect(record).toMatchObject({
        url: "https://cdn.example.com/keten-sal.jpg",
        derivatives: null,
      })
      expect((await post(`/admin/media/${record?.id ?? ""}`, { alt: "Keten şal" })).status).toBe(
        200
      )

      // Another product's image has none: the store-wide audit counts it
      const [file] = await uploaded(await photo(500, 500))
      await post("/admin/media", { file_ids: [file?.id] })
      await post("/admin/products", product("keten-kemer", [file?.url ?? ""]))
      const queued = await post<{ async_job: { id: string } }>("/admin/async-jobs", {
        type: "seo.audit",
        input: {},
      })
      let findings: { ruleId: string; count: number; items: { subject: string }[] }[] = []
      for (let attempt = 0; attempt < 100 && findings.length === 0; attempt++) {
        const { data } = await http.get<{
          async_job: { status: string; result_summary: { findings: typeof findings } | null }
        }>(`/admin/async-jobs/${queued.data.async_job.id}`, admin)
        findings =
          data.async_job.status === "succeeded"
            ? (data.async_job.result_summary?.findings ?? [])
            : []
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(findings.find((each) => each.ruleId === "S-IMG-01")).toMatchObject({ count: 1 })
    })

    it("refuses a path that walks to images through another record", async () => {
      const store = await createStorefront(getContainer())
      const nested = await settle(
        http.get("/store/products?fields=id,variants.product.media_assets.file_id", {
          headers: store.headers,
        })
      )
      expect(nested.status).toBe(400)
    })

    it("removes an upload no product took after a day, and keeps one a product had", async () => {
      const media = getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
      const [left, kept] = await uploaded(await photo(300, 300), await photo(300, 300))
      const registered = await post<{ media: { id: string }[] }>("/admin/media", {
        file_ids: [left?.id, kept?.id],
      })
      const [leftId, keptId] = registered.data.media.map((each) => each.id)
      const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
      // Put on a product once, then dropped: orders may still show it
      await media.updateMediaAssets({ id: keptId ?? "", attached_at: dayAgo })
      await setCreatedAt(getContainer(), [leftId ?? "", keptId ?? ""], dayAgo)

      await mediaSweep(getContainer())
      const remaining = await media.listMediaAssets({ id: [leftId ?? "", keptId ?? ""] })
      expect(remaining.map((each) => each.id)).toEqual([keptId])
      expect(storedPath(left?.url ?? "")).toBeUndefined()
      expect(storedPath(kept?.url ?? "")).toBeDefined()
    })
  },
})

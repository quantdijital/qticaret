import { existsSync, rmSync } from "node:fs"
import { basename } from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import sharp from "sharp"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import mediaSweep from "../../src/jobs/media-sweep"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { mediaImportFetch } from "../../src/workflows/media/import-fetch"

jest.setTimeout(120 * 1000)

interface Media {
  id: string
  url: string
  filename: string
  mime_type: string | null
  size: number | null
  width: number | null
  height: number | null
  alt: string | null
}

interface Detail extends Media {
  uploaded_by: { id: string; name: string } | null
  usage: { kind: string; id: string | null; label: string | null }[]
}

const picture = (width: number, height: number, format: "png" | "jpeg" = "png") => {
  const canvas = sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 90, b: 160 } },
  })
  return (format === "png" ? canvas.png() : canvas.jpeg()).toBuffer()
}

const storedPath = (url: string) => filesNamed(new RegExp(`^${basename(url)}$`))[0]

/** The media library (docs/06 Ortam kütüphanesi): list, upload, import, rename, delete. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const realFetch = mediaImportFetch.get
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const get = <T>(url: string) =>
      settle(http.get<T & { message?: string }>(url, { headers: admin.headers }))
    const remove = <T>(url: string) =>
      settle(http.delete<T & { message?: string }>(url, { headers: admin.headers }))

    async function upload(name: string, bytes: Buffer, library = true): Promise<Media> {
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), name)
      const { data } = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, admin)
      const registered = await post<{ media: Media[] }>("/admin/media", {
        file_ids: data.files.map((file) => file.id),
        library,
      })
      expect(registered.status).toBe(200)
      const [media] = registered.data.media
      if (!media) {
        throw new Error("no media registered")
      }
      return media
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      mediaImportFetch.get = realFetch
    })

    afterAll(() => {
      mediaImportFetch.get = realFetch
      for (const path of filesNamed(/(vitrin|kapak|logo|kampanya|eski|yeni)-?/)) {
        rmSync(path, { force: true })
      }
    })

    it("lists uploads newest first with their name, type, bytes and size, and finds them", async () => {
      const first = await upload("Vitrin Görseli.png", await picture(800, 400))
      const second = await upload("kapak.png", await picture(300, 200, "jpeg"))

      // The bytes decide the type: a JPEG named .png is stored and listed as one
      expect(second).toMatchObject({ filename: "kapak.jpg", mime_type: "image/jpeg", width: 300 })
      expect(first).toMatchObject({
        filename: "vitrin-gorseli.png",
        mime_type: "image/png",
        width: 800,
        height: 400,
      })
      expect(first.size).toBeGreaterThan(0)

      const page = await get<{ media: Media[]; count: number }>("/admin/media?limit=1")
      expect(page.status).toBe(200)
      expect(page.data.count).toBeGreaterThanOrEqual(2)
      expect(page.data.media.map((each) => each.id)).toEqual([second.id])
      const next = await get<{ media: Media[] }>("/admin/media?limit=1&offset=1&kind=image")
      expect(next.data.media.map((each) => each.id)).toEqual([first.id])

      const found = await get<{ media: Media[] }>("/admin/media?q=vitrin")
      expect(found.data.media.map((each) => each.id)).toEqual([first.id])
      const refused = await get("/admin/media?kind=video")
      expect(refused.status).toBe(400)
    })

    it("renames and describes an image; its address stays, a bad name is refused", async () => {
      const image = await upload("eski-ad.png", await picture(120, 80))

      const renamed = await post<{ media: { filename: string; alt: string | null } }>(
        `/admin/media/${image.id}`,
        { filename: "  Yaz kampanyası afişi  " }
      )
      const described = await post<{ media: { filename: string; alt: string | null } }>(
        `/admin/media/${image.id}`,
        { alt: "Yaz kampanyası afişi, mavi zemin" }
      )
      const detail = await get<{ media: Detail }>(`/admin/media/${image.id}`)

      expect(renamed.data.media).toMatchObject({ filename: "Yaz kampanyası afişi", alt: null })
      expect(described.data.media).toMatchObject({ filename: "Yaz kampanyası afişi" })
      expect(detail.data.media).toMatchObject({
        url: image.url,
        filename: "Yaz kampanyası afişi",
        alt: "Yaz kampanyası afişi, mavi zemin",
        usage: [],
      })
      expect(detail.data.media.uploaded_by?.id).toMatch(/^user_/)
      expect(await post(`/admin/media/${image.id}`, {})).toMatchObject({
        status: 400,
        data: { message: "media.update_empty" },
      })
      expect((await post(`/admin/media/${image.id}`, { filename: "a\u0000b" })).status).toBe(400)
      expect((await get("/admin/media/media_01NOPE")).status).toBe(404)
    })

    it("refuses to delete an image a product, a page or a brand shows, and says where", async () => {
      const onProduct = await upload("vitrin-urun.png", await picture(200, 200))
      const onPage = await upload("kapak-sayfa.png", await picture(200, 100))
      const onBrand = await upload("logo-marka.png", await picture(100, 100))
      const product = await post<{ product: { id: string } }>("/admin/products", {
        title: "Masa Lambası",
        handle: "masa-lambasi",
        status: "published",
        weight: 250,
        length: 30,
        width: 5,
        height: 2,
        images: [{ url: onProduct.url }],
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
      expect(product.status).toBe(200)
      const page = await post<{ entry: { id: string } }>("/admin/content", {
        kind: "page",
        title: "Hakkımızda",
        image_url: onPage.url,
      })
      expect(page.status).toBe(201)
      // A brand's logo is held by the file's storage key
      const row = (await getContainer()
        .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)("media_asset")
        .first("file_id")
        .where("id", onBrand.id)) as { file_id: string }
      const brand = await post("/admin/brands", { name: "Örnek Marka", logo_file_id: row.file_id })
      expect(brand.status).toBe(201)

      for (const [image, kind] of [
        [onProduct, "product"],
        [onPage, "content"],
        [onBrand, "brand"],
      ] as const) {
        const detail = await get<{ media: Detail }>(`/admin/media/${image.id}`)
        expect(detail.data.media.usage.map((use) => use.kind)).toContain(kind)
        const refused = await remove(`/admin/media/${image.id}`)
        expect(refused.status).toBe(409)
        expect(refused.data.message).toBe("media.in_use")
        expect(existsSync(storedPath(image.url) ?? "")).toBe(true)
      }
    })

    it("deletes an unused image with its file, and records who did it", async () => {
      const image = await upload("yeni-silinecek.png", await picture(90, 60))
      const path = storedPath(image.url)
      expect(path && existsSync(path)).toBe(true)

      const deleted = await remove<{ id: string; deleted: boolean }>(`/admin/media/${image.id}`)

      expect(deleted.data).toMatchObject({ id: image.id, deleted: true })
      expect(existsSync(path ?? "")).toBe(false)
      expect((await get(`/admin/media/${image.id}`)).status).toBe(404)
      const list = await get<{ media: Media[] }>("/admin/media?q=silinecek")
      expect(list.data.media).toEqual([])
      const audit = await eventually(
        () =>
          getContainer()
            .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
            .listAuditEntries({ resource_id: image.id, action: "DELETE /admin/media/:id" }),
        (rows) => rows.length > 0
      )
      expect(audit[0]).toMatchObject({ actor_type: "user", outcome: 200 })
    })

    it("brings an image in from its address, cleaned, and refuses addresses it may not reach", async () => {
      const bytes = await picture(640, 320)
      mediaImportFetch.get = (address: string) =>
        address === "https://cdn.example.com/kampanya.png"
          ? Promise.resolve(bytes)
          : Promise.resolve(Buffer.from("<html>not an image</html>"))

      const imported = await post<{ media: Media }>("/admin/media/import", {
        url: "https://cdn.example.com/kampanya.png",
      })
      const notImage = await post("/admin/media/import", { url: "https://cdn.example.com/a.png" })
      mediaImportFetch.get = realFetch
      const privateAddress = await post("/admin/media/import", { url: "http://127.0.0.1/a.png" })

      expect(imported.status).toBe(201)
      expect(imported.data.media).toMatchObject({
        filename: "kampanya.png",
        mime_type: "image/png",
        width: 640,
        height: 320,
      })
      expect(imported.data.media.url).not.toContain("cdn.example.com")
      expect(existsSync(storedPath(imported.data.media.url) ?? "")).toBe(true)
      const listed = await get<{ media: Media[] }>("/admin/media?q=kampanya")
      expect(listed.data.media.map((each) => each.id)).toContain(imported.data.media.id)
      expect(notImage.data).toMatchObject({ message: "upload.unsupported_type" })
      expect(privateAddress.status).toBe(400)
      expect(privateAddress.data.message).toBe("media.import_address_refused")
    })

    it("keeps library images and used ones through the nightly sweep; an abandoned upload goes", async () => {
      const kept = await upload("vitrin-kalici.png", await picture(50, 50))
      const left = await upload("vitrin-terk.png", await picture(50, 50), false)
      // A product upload picked from the library as a brand's logo, which marks nothing
      const logo = await upload("logo-secilen.png", await picture(50, 50), false)
      const knex = getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      const { file_id: logoFile } = (await knex("media_asset")
        .first("file_id")
        .where("id", logo.id)) as { file_id: string }
      expect(
        (await post("/admin/brands", { name: "Seçilen", logo_file_id: logoFile })).status
      ).toBe(201)
      const ids = [kept.id, left.id, logo.id]
      await knex("media_asset")
        .whereIn("id", ids)
        .update({ created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })

      await mediaSweep(getContainer())

      const rows = (await knex("media_asset")
        .select("id")
        .whereIn("id", ids)
        .whereNull("deleted_at")) as { id: string }[]
      expect(rows.map((row) => row.id).sort()).toEqual([kept.id, logo.id].sort())
    })
  },
})

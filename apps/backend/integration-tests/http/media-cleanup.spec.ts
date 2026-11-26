import { existsSync, rmSync } from "node:fs"
import { basename } from "node:path"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { createAdminUser } from "../helpers/admin"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Media {
  id: string
  url: string
  file_id: string | null
  alt: string | null
}

interface Deleted {
  deleted: string[]
  failed: string[]
  in_use: string[]
  missing: string[]
}

const picture = () =>
  sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 10, g: 90, b: 60 } } })
    .png()
    .toBuffer()

const storedPath = (url: string) => filesNamed(new RegExp(`^${basename(url)}$`))[0]

/**
 * The media library's clean-up (M1): the "Kullanılmayan" view lists only
 * pictures nothing shows, found wherever they are held (a product, a
 * page, a document by a version's or a key's name); the bulk delete
 * takes only those and keeps the rest, whatever the panel sent.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const knex = () => getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const get = <T>(url: string) =>
      settle(http.get<T & { message?: string }>(url, { headers: admin.headers }))

    async function upload(name: string): Promise<Media> {
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(await picture())], { type: "image/png" }), name)
      const { data } = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, admin)
      const registered = await post<{ media: Media[] }>("/admin/media", {
        file_ids: data.files.map((file) => file.id),
        library: true,
      })
      expect(registered.status).toBe(200)
      const [media] = registered.data.media
      if (!media?.file_id) {
        throw new Error("no media registered")
      }
      return media
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    afterAll(() => {
      for (const path of filesNamed(/^temizlik-/)) {
        rmSync(path, { force: true })
      }
    })

    it("lists only pictures nothing shows and deletes only those", async () => {
      const loose = await upload("temizlik-bos.png")
      const spare = await upload("temizlik-yedek.png")
      const onProduct = await upload("temizlik-urun.png")
      const onPage = await upload("temizlik-sayfa.png")
      const inDocument = await upload("temizlik-belge.png")

      const product = await post("/admin/products", {
        title: "Temizlik Kupası",
        status: "draft",
        images: [{ url: onProduct.url }],
        options: [{ title: "Boyut", values: ["Standart"] }],
        variants: [
          {
            title: "Standart",
            options: { Boyut: "Standart" },
            manage_inventory: false,
            prices: [{ currency_code: "try", amount: 100 }],
          },
        ],
      })
      expect(product.status).toBe(200)
      const page = await post<{ entry: { id: string } }>("/admin/content", {
        kind: "page",
        title: "Temizlik Sayfası",
        image_url: onPage.url,
      })
      expect(page.status).toBe(201)
      // A document holding the picture by its key under another address (a resized copy):
      // the detail's own uses miss it, the clean-up's wide check must not
      const other = await post<{ entry: { id: string } }>("/admin/content", {
        kind: "page",
        title: "Belge Sayfası",
      })
      expect(other.status).toBe(201)
      await knex()("content_entry")
        .where("id", other.data.entry.id)
        .update({
          body: JSON.stringify({
            type: "doc",
            content: [
              {
                type: "image",
                attrs: { src: `https://cdn.example.com/w_640/${inDocument.file_id ?? ""}` },
              },
            ],
          }),
        })

      const unused = await get<{ media: Media[]; count: number }>(
        "/admin/media?view=unused&limit=100"
      )
      expect(unused.status).toBe(200)
      expect(unused.data.media.map((each) => each.id).sort()).toEqual([loose.id, spare.id].sort())
      expect(unused.data.count).toBe(2)
      // Searched within the view
      const searched = await get<{ media: Media[] }>("/admin/media?view=unused&q=yedek")
      expect(searched.data.media.map((each) => each.id)).toEqual([spare.id])

      // The panel's list is not trusted: pictures in use are kept and named
      const answer = await post<Deleted>("/admin/media/delete", {
        ids: [loose.id, onProduct.id, onPage.id, inDocument.id, "media_01YOK"],
      })
      expect(answer.status).toBe(200)
      expect(answer.data).toEqual({
        deleted: [loose.id],
        failed: [],
        in_use: [onProduct.id, onPage.id, inDocument.id],
        missing: ["media_01YOK"],
      })
      expect(existsSync(storedPath(loose.url) ?? "")).toBe(false)
      for (const kept of [onProduct, onPage, inDocument]) {
        expect(existsSync(storedPath(kept.url) ?? "")).toBe(true)
        expect((await get(`/admin/media/${kept.id}`)).status).toBe(200)
      }
      expect((await get(`/admin/media/${loose.id}`)).status).toBe(404)
    })

    it("lists pictures without an alt text, and refuses a malformed delete", async () => {
      const bare = await upload("temizlik-altsiz.png")
      const described = await upload("temizlik-altli.png")
      expect(
        (await post(`/admin/media/${described.id}`, { alt: "Yeşil zemin üzerinde kare" })).status
      ).toBe(200)
      const missing = await get<{ media: Media[] }>("/admin/media?view=missing_alt&limit=100")
      const ids = missing.data.media.map((each) => each.id)
      expect(ids).toContain(bare.id)
      expect(ids).not.toContain(described.id)

      for (const body of [
        { ids: [] },
        { ids: [bare.id, bare.id] },
        { ids: ["../../etc/passwd"] },
        { ids: [bare.id], force: true },
      ]) {
        expect((await post("/admin/media/delete", body)).status).toBe(400)
      }
      expect((await get(`/admin/media/${bare.id}`)).status).toBe(200)
    })
  },
})

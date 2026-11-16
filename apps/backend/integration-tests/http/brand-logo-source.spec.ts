import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import sharp from "sharp"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Brand {
  id: string
  logo_url: string | null
  logo_width: number | null
}

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><rect width="64" height="32"/></svg>'

const picture = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 40, g: 90, b: 160 } } })
    .png()
    .toBuffer()

/**
 * Where a brand's logo comes from (#115 güvenlik incelemesi, Bilgi-1): an
 * image in the media library only. Any other stored file (an invoice, a
 * label, a feed), even with its key known, is refused, so its address
 * never reaches the Store API; a logo kept from before the rule stays.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<T & { message?: string }>(url, body, { headers }))
    const knex = () => getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)

    /** A file through the checked upload route; registered in the library unless `library` is false. */
    async function upload(name: string, blob: Blob, library = true): Promise<string> {
      const form = new FormData()
      form.append("files", blob, name)
      const { data } = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, admin)
      const fileId = data.files[0]?.id ?? ""
      if (library) {
        const registered = await post("/admin/media", { file_ids: [fileId], library: true })
        expect(registered.status).toBe(200)
      }
      return fileId
    }
    const png = async (name: string, library = true) =>
      upload(
        name,
        new Blob([new Uint8Array(await picture(300, 100))], { type: "image/png" }),
        library
      )

    /** A file the server put in storage itself (an invoice's PDF, a label): no media record. */
    async function storedFile(
      filename: string,
      mimeType: string,
      bytes: Buffer,
      access: "public" | "private"
    ): Promise<string> {
      const [file] = await getContainer()
        .resolve(Modules.FILE)
        .createFiles([{ filename, mimeType, content: bytes.toString("base64"), access }])
      return file?.id ?? ""
    }
    const storedDocument = () =>
      storedFile("fatura-ornek.pdf", "application/pdf", Buffer.from("%PDF-1.4 no logo"), "private")

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    it("takes an image from the library and gives its address to the Store API", async () => {
      const logo = await png("kutuphane-logo.png")
      const created = await post<{ brand: Brand }>("/admin/brands", {
        name: "Kütüphane",
        logo_file_id: logo,
      })
      expect(created.status).toBe(201)
      expect(created.data.brand).toMatchObject({ logo_width: 300 })
      const listed = await settle(
        http.get<{ brands: Brand[] }>("/store/brands", { headers: store.headers })
      )
      expect(listed.data.brands[0]?.logo_url).toBe(created.data.brand.logo_url)

      // An upload not yet kept on purpose has its record too (the library lists it): taken
      const uploaded = await png("yuklenen-logo.png", false)
      const fromUpload = await post("/admin/brands", { name: "Yüklenen", logo_file_id: uploaded })
      expect(fromUpload.status).toBe(201)
    })

    it("refuses a stored file the library does not hold, even with its key known", async () => {
      const document = await storedDocument()
      // A picture the server stored itself (as a shipping label's is): an image, no record
      const label = await storedFile(
        "kargo-etiketi.png",
        "image/png",
        await picture(300, 100),
        "public"
      )
      for (const key of [document, label, "file_01NOPE"]) {
        const created = await post("/admin/brands", {
          name: `Anahtar ${String(key.length)}`,
          logo_file_id: key,
        })
        expect([created.status, created.data.message]).toEqual([400, "brands.logo_unknown"])
      }
      // Changing an existing brand's logo to one is refused as well, and leaves it as it was
      const brand = (await post<{ brand: Brand }>("/admin/brands", { name: "Var Olan" })).data.brand
      const changed = await post(`/admin/brands/${brand.id}`, { logo_file_id: document })
      expect([changed.status, changed.data.message]).toEqual([400, "brands.logo_unknown"])
      const [row] = (await knex()("brand").select("logo_file_id").where("id", brand.id)) as {
        logo_file_id: string | null
      }[]
      expect(row?.logo_file_id).toBeNull()
    })

    it("refuses a library record that is no image, and an SVG as before", async () => {
      const document = await storedDocument()
      await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .createMediaAssets({
          file_id: document,
          url: `http://localhost/static/${document}`,
          mime_type: "application/pdf",
        })
      const pdf = await post("/admin/brands", { name: "Belge", logo_file_id: document })
      expect([pdf.status, pdf.data.message]).toEqual([400, "brands.logo_unknown"])

      // A cleaned SVG is in the library, yet a brand's logo is a catalogue picture
      const svg = await upload("logo.txt", new Blob([SVG], { type: "text/plain" }))
      const vector = await post("/admin/brands", { name: "Vektör", logo_file_id: svg })
      expect([vector.status, vector.data.message]).toEqual([400, "media.svg_logo_only"])
    })

    it("keeps a logo set before the rule while the brand is saved, and lets it be taken off", async () => {
      const document = await storedDocument()
      const brand = (await post<{ brand: Brand }>("/admin/brands", { name: "Eski Logo" })).data
        .brand
      // As a brand saved before the rule stands: a logo outside the library
      await knex()("brand")
        .where("id", brand.id)
        .update({ logo_file_id: document, logo_url: "http://localhost/static/eski.png" })
      const renamed = await post<{ brand: Brand }>(`/admin/brands/${brand.id}`, {
        name: "Eski Logo 2",
        logo_file_id: document,
      })
      expect(renamed.status).toBe(200)
      expect(renamed.data.brand.logo_url).toBe("http://localhost/static/eski.png")
      const removed = await post<{ brand: Brand }>(`/admin/brands/${brand.id}`, {
        logo_file_id: null,
      })
      expect(removed.data.brand.logo_url).toBeNull()
    })

    it("lets no one set a logo without signing in", async () => {
      const brand = (await post<{ brand: Brand }>("/admin/brands", { name: "İzinsiz" })).data.brand
      const logo = await png("izinsiz.png")
      const anonymous = await post(`/admin/brands/${brand.id}`, { logo_file_id: logo }, {})
      expect(anonymous.status).toBe(401)
      const created = await post("/admin/brands", { name: "İzinsiz 2", logo_file_id: logo }, {})
      expect(created.status).toBe(401)
    })
  },
})

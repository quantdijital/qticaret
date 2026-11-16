import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import sharp from "sharp"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { fillBrandLogoSizes } from "../../src/workflows/brands/backfill-logo-sizes"

jest.setTimeout(120 * 1000)

interface Brand {
  id: string
  logo_url: string | null
  logo_width: number | null
  logo_height: number | null
}

const picture = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 40, g: 90, b: 160 } } })
    .png()
    .toBuffer()

/**
 * A brand logo's size (marka logosu boyutu): read on the server when the
 * logo is set, never taken from the request, unknown when the file says
 * none; the Store API gives it; a backfill fills logos set before.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<T & { message?: string }>(url, body, { headers }))
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))
    const knex = () => getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)

    /** An image uploaded through the checked route; in the library unless `library` is false. */
    async function upload(name: string, bytes: Buffer, library = true): Promise<string> {
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), name)
      const { data } = await http.post<{ files: { id: string }[] }>("/admin/uploads", form, admin)
      const fileId = data.files[0]?.id ?? ""
      if (library) {
        const registered = await post("/admin/media", { file_ids: [fileId], library: true })
        expect(registered.status).toBe(200)
      }
      return fileId
    }

    /** A stored file that is no image (put in storage some other way): its size cannot be read. */
    async function textFile(): Promise<string> {
      const [file] = await getContainer()
        .resolve(Modules.FILE)
        .createFiles([
          {
            filename: "logo-notu.txt",
            mimeType: "text/plain",
            content: Buffer.from("not a picture").toString("base64"),
            access: "public",
          },
        ])
      return file?.id ?? ""
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
    })

    it("measures a logo on the server when it is set, changed or taken off", async () => {
      const wide = await upload("genis-logo.png", await picture(300, 100))
      const created = await post<{ brand: Brand }>("/admin/brands", {
        name: "Örnek Çelik",
        logo_file_id: wide,
      })
      expect(created.status).toBe(201)
      const id = created.data.brand.id
      expect(created.data.brand).toMatchObject({ logo_width: 300, logo_height: 100 })

      // The Store API gives it beside the logo's address: the list and the brand's own answer
      const listed = await storeGet<{ brands: Brand[] }>("/store/brands")
      expect(listed.data.brands[0]).toMatchObject({ id, logo_width: 300, logo_height: 100 })
      expect(listed.data.brands[0]?.logo_url).toBe(created.data.brand.logo_url)
      const one = await storeGet<{ brand: Brand }>(`/store/brands/${id}`)
      expect(one.data.brand).toMatchObject({ logo_width: 300, logo_height: 100 })

      // Another logo, another size; a save that leaves the logo keeps its size
      const square = await upload("kare-logo.png", await picture(120, 120))
      const changed = await post<{ brand: Brand }>(`/admin/brands/${id}`, { logo_file_id: square })
      expect(changed.data.brand).toMatchObject({ logo_width: 120, logo_height: 120 })
      const renamed = await post<{ brand: Brand }>(`/admin/brands/${id}`, { name: "Örnek Çelik 2" })
      expect(renamed.data.brand).toMatchObject({ logo_width: 120, logo_height: 120 })

      // Taken off: the size goes with it
      const removed = await post<{ brand: Brand }>(`/admin/brands/${id}`, { logo_file_id: null })
      expect(removed.status).toBe(200)
      expect(removed.data.brand).toMatchObject({
        logo_url: null,
        logo_width: null,
        logo_height: null,
      })
    })

    it("reads a file outside the library by its header, and leaves one with no size unknown", async () => {
      // Uploaded and never put in the library: no record, its header says its size
      const loose = await upload("serbest-logo.png", await picture(240, 60), false)
      const fromHeader = await post<{ brand: Brand }>("/admin/brands", {
        name: "Serbest",
        logo_file_id: loose,
      })
      expect(fromHeader.status).toBe(201)
      expect(fromHeader.data.brand).toMatchObject({ logo_width: 240, logo_height: 60 })

      // No image at all: the save goes through, the logo drawn as before (no size)
      const unknown = await post<{ brand: Brand }>("/admin/brands", {
        name: "Ölçülemez",
        logo_file_id: await textFile(),
      })
      expect(unknown.status).toBe(201)
      expect(unknown.data.brand.logo_url).not.toBeNull()
      expect(unknown.data.brand).toMatchObject({ logo_width: null, logo_height: null })
    })

    it("takes no size from the request, and lets no one in without signing in", async () => {
      const sent = await post<{ brand: Brand }>("/admin/brands", {
        name: "Elle",
        logo_width: 9999,
        logo_height: 1,
      })
      expect(sent.status).toBe(400)
      // A key out of storage's folder is refused before anything reads it
      for (const key of ["../yol.png", "/yol.png"]) {
        expect((await post("/admin/brands", { name: "Yol", logo_file_id: key })).status).toBe(400)
      }
      const brand = (await post<{ brand: Brand }>("/admin/brands", { name: "Elle" })).data.brand
      const changed = await post(`/admin/brands/${brand.id}`, { logo_width: 9999 })
      expect(changed.status).toBe(400)

      const logo = await upload("izinsiz.png", await picture(300, 100))
      const anonymous = await post(`/admin/brands/${brand.id}`, { logo_file_id: logo }, {})
      expect(anonymous.status).toBe(401)
      const [row] = (await knex()("brand")
        .select("logo_file_id", "logo_width")
        .where("id", brand.id)) as { logo_file_id: string | null; logo_width: number | null }[]
      expect(row).toEqual({ logo_file_id: null, logo_width: null })
    })

    it("fills logos set before sizes were kept, once, and leaves the unmeasurable alone", async () => {
      const wide = await upload("eski-logo.png", await picture(600, 100))
      const old = (
        await post<{ brand: Brand }>("/admin/brands", { name: "Eski", logo_file_id: wide })
      ).data.brand
      const broken = (
        await post<{ brand: Brand }>("/admin/brands", {
          name: "Bozuk",
          logo_file_id: await textFile(),
        })
      ).data.brand
      const bare = (await post<{ brand: Brand }>("/admin/brands", { name: "Logosuz" })).data.brand
      // As a brand saved before the migration stands: a logo, no size
      await knex()("brand").where("id", old.id).update({ logo_width: null, logo_height: null })

      const run = (apply: boolean) => fillBrandLogoSizes(getContainer(), { apply })
      const checked = await run(false)
      expect(checked).toEqual({ missing: 2, measured: 1, unmeasured: [broken.id], written: 0 })
      const [still] = (await knex()("brand").select("logo_width").where("id", old.id)) as {
        logo_width: number | null
      }[]
      expect(still?.logo_width).toBeNull()

      const applied = await run(true)
      expect(applied).toEqual({ missing: 2, measured: 1, unmeasured: [broken.id], written: 1 })
      const { data } = await storeGet<{ brands: Brand[] }>("/store/brands")
      const byId = new Map(data.brands.map((brand) => [brand.id, brand]))
      expect(byId.get(old.id)).toMatchObject({ logo_width: 600, logo_height: 100 })
      expect(byId.get(broken.id)).toMatchObject({ logo_width: null, logo_height: null })
      expect(byId.get(bare.id)).toMatchObject({ logo_url: null, logo_width: null })

      // Again: nothing more to write
      expect(await run(true)).toEqual({
        missing: 1,
        measured: 0,
        unmeasured: [broken.id],
        written: 0,
      })
    })

    it("lets a product's brand carry its logo's size in the Store API", async () => {
      const logo = await upload("urun-marka.png", await picture(300, 100))
      const brand = (
        await post<{ brand: Brand }>("/admin/brands", { name: "Ürün Markası", logo_file_id: logo })
      ).data.brand
      const { data } = await post<{ product: { id: string } }>("/admin/products", {
        title: "Örnek Ürün",
        status: "published",
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
      await post(`/admin/products/${data.product.id}/brand`, { brand_id: brand.id })
      const listed = await storeGet<{ products: { brand?: Brand }[] }>(
        "/store/products?fields=id,brand.logo_url,brand.logo_width,brand.logo_height"
      )
      expect(listed.status).toBe(200)
      expect(listed.data.products[0]?.brand).toMatchObject({ logo_width: 300, logo_height: 100 })
    })
  },
})

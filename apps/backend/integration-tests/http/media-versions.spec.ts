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
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { backfillMediaVersions } from "../../src/workflows/media/backfill"

jest.setTimeout(180 * 1000)

interface Version {
  width: number
  url: string
}

interface Derivatives {
  srcset: { webp: Version[]; avif: Version[] }
  og: { url: string; width: number; height: number } | null
}

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 160, g: 90, b: 40 } } })
    .jpeg()
    .toBuffer()

const product = (handle: string, url: string) => ({
  title: "Kamp Bıçağı",
  handle,
  status: "published",
  images: [{ url }],
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

const storedPath = (url: string) => filesNamed(new RegExp(`^${basename(url)}$`))[0]

const versionUrls = (derivatives: Derivatives) => [
  ...derivatives.srcset.webp.map((version) => version.url),
  ...derivatives.srcset.avif.map((version) => version.url),
  ...(derivatives.og ? [derivatives.og.url] : []),
]

/**
 * docs/21 2026-11-06, open item 1: every library picture gets the versions a
 * product image has, at upload; `media:derivatives` makes them for the
 * pictures stored before.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))

    async function upload(name: string, image: Buffer): Promise<{ id: string; url: string }> {
      const form = new FormData()
      form.append("files", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), name)
      const { data } = await http.post<{ files: { id: string; url: string }[] }>(
        "/admin/uploads",
        form,
        admin
      )
      const [file] = data.files
      if (!file) {
        throw new Error("upload returned no file")
      }
      return file
    }

    async function register(name: string, image: Buffer, library: boolean) {
      const file = await upload(name, image)
      const { data } = await post<{ media: { id: string; url: string }[] }>("/admin/media", {
        file_ids: [file.id],
        library,
      })
      const [asset] = data.media
      if (!asset) {
        throw new Error("register returned no media")
      }
      return asset
    }

    const assetOf = async (id: string) => {
      const [asset] = await media().listMediaAssets({ id }, { take: 1 })
      return asset
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    afterAll(() => {
      for (const path of filesNamed(/(kapak-fotografi|Kapak Foto|eski-|kamp-bicagi)/)) {
        rmSync(path, { force: true })
      }
    })

    it("makes a library upload's versions after the answer, named after the picture", async () => {
      const asset = await register("Kapak Fotoğrafı.jpg", await photo(1000, 600), true)
      const derived = await eventually(
        () => assetOf(asset.id),
        (row) => Boolean(row?.derivatives),
        100
      )
      const derivatives = derived?.derivatives as unknown as Derivatives
      expect(derivatives.srcset.webp.map((version) => version.width)).toEqual([400, 800, 1000])
      expect(derivatives.srcset.avif.map((version) => version.width)).toEqual([400, 800, 1000])
      expect(derivatives.og).toMatchObject({ width: 1200, height: 630 })
      expect(derived?.derived_for).toBeNull()
      expect(derived?.derivative_file_ids).toHaveLength(7)
      for (const url of versionUrls(derivatives)) {
        expect(basename(url)).toMatch(/kapak-fotografi-(400|800|1000|og)\.(webp|avif|jpg)$/)
        const path = storedPath(url)
        expect(path && existsSync(path)).toBe(true)
      }

      // A product's upload is left to its product (adr/0016): no versions of its own
      const forProduct = await register("kamp-bicagi.jpg", await photo(600, 600), false)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      expect((await assetOf(forProduct.id))?.derivatives).toBeNull()
    })

    it("backfills the pictures stored before: a dry run, then apply, then nothing left", async () => {
      const container = getContainer()
      // Stored before versions were made at upload: registered with none asked
      const old = [
        await register("eski-kapak.jpg", await photo(900, 500), false),
        await register("eski-yazar.jpg", await photo(500, 500), false),
        await register("eski-govde.jpg", await photo(1800, 900), false),
      ]
      // A product's picture whose versions went missing
      const held = await register("kamp-bicagi-1.jpg", await photo(700, 700), false)
      const made = await post<{ product: { id: string } }>(
        "/admin/products",
        product("kamp-bicagi", held.url)
      )
      expect(made.status).toBe(200)
      await eventually(
        () => assetOf(held.id),
        (row) => Boolean(row?.derivatives),
        100
      )
      const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      await knex("media_asset")
        .where({ id: held.id })
        .update({ derivatives: null, derivative_file_ids: null, derived_for: null })

      const dry = await backfillMediaVersions(container, {
        apply: false,
        batch: 2,
      })
      expect(dry).toEqual({
        missing: 4,
        library: 3,
        product_images: 1,
        products: 1,
        made: 0,
        failed: 0,
      })
      for (const asset of [...old, held]) {
        expect((await assetOf(asset.id))?.derivatives).toBeNull()
      }

      const applied = await backfillMediaVersions(container, {
        apply: true,
        batch: 2,
      })
      expect(applied).toMatchObject({ missing: 4, library: 3, product_images: 1, made: 4 })
      expect(applied.failed).toBe(0)
      const govde = (await assetOf(old[2]?.id ?? ""))?.derivatives as unknown as Derivatives
      expect(govde.srcset.webp.map((version) => version.width)).toEqual([400, 800, 1600])
      expect(basename(govde.srcset.avif[0]?.url ?? "")).toMatch(/eski-govde-400\.avif$/)
      // The product's picture through its product's run, named after the product
      const product1 = await assetOf(held.id)
      expect(product1?.derived_for).toBe("kamp-bicagi:1")
      const productVersions = product1?.derivatives as unknown as Derivatives
      expect(basename(productVersions.srcset.webp[0]?.url ?? "")).toMatch(
        /kamp-bicagi-1-400\.webp$/
      )

      const again = await backfillMediaVersions(container, { apply: true })
      expect(again).toEqual({
        missing: 0,
        library: 0,
        product_images: 0,
        products: 0,
        made: 0,
        failed: 0,
      })
    })
  },
})

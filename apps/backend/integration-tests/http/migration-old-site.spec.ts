import { randomBytes } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { DEMO_SHOPIFY, startFakeShopify } from "@qticaret/testing"
import type { FakeShopify } from "@qticaret/testing"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"

jest.setTimeout(600 * 1000)

/** F14.7 (adr/0042 §8): the old site's sitemap and Search Console's top pages into the inventory. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const app = { clientId: "test-shopify-app-0002", clientSecret: randomBytes(16).toString("hex") }
    let shopify: FakeShopify
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    const { settled } = sheetClient(http, getContainer, () => owner.headers)
    const inventory = () =>
      getContainer().resolve<MigrationModuleService>(MIGRATION_MODULE).listMigrationUrls({})
    const sitemap = (url: string) =>
      settle(
        http.post<{ async_job: SheetJob; message?: string }>(
          "/admin/migrations/urls/sitemap",
          { url },
          { headers: owner.headers }
        )
      )

    beforeAll(async () => {
      shopify = await startFakeShopify(app, { data: structuredClone(DEMO_SHOPIFY) })
      process.env["SHOPIFY_BASE_URL"] = shopify.url
    })

    afterAll(async () => {
      Reflect.deleteProperty(process.env, "SHOPIFY_BASE_URL")
      await shopify.close()
    })

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
    })

    it("reads the sitemap's index and its sitemaps, the old site's addresses only", async () => {
      const queued = await sitemap(`${shopify.url}/sitemap.xml`)
      expect(queued.status).toBe(202)
      const job = await settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      // The index, the products sitemap, the gzipped pages one; another site's two left
      expect(job.result_summary).toMatchObject({ files: 3, addresses: 5, elsewhere: 2 })
      const rows = await inventory()
      expect(rows.map((row) => row.address).sort()).toEqual([
        "/collections/indirimdekiler",
        "/collections/tavalar",
        "/pages/hakkimizda",
        "/products/ahşap-kaşık",
        "/products/dokum-tava",
      ])
      expect(rows.every((row) => row.origins.includes("sitemap"))).toBe(true)

      // A sitemap at the cloud's metadata address is never fetched (docs/04)
      const inside = await sitemap("http://169.254.169.254/latest/sitemap.xml")
      expect((await settled(inside.data.async_job.id)).status).toBe("failed")
    })

    it("adds Search Console's top pages with their clicks, refusing a file that is none", async () => {
      const upload = (body: string) =>
        settle(
          http.post<{ rows: number; addresses: number; message?: string }>(
            "/admin/migrations/urls/search-console",
            Buffer.from(body, "utf8"),
            { headers: { ...owner.headers, "content-type": "text/csv" } }
          )
        )
      const csv =
        "En çok tıklanan sayfalar,Tıklamalar,Gösterimler,TO,Konum\n" +
        "https://eski.example.com/products/dokum-tava,900,9000,10%,3\n" +
        "https://eski.example.com/products/dokum-tava/,10,90,10%,3\n" +
        "https://eski.example.com/eski-kampanya,500,5000,10%,4\n"
      const read = await sitemap(`${shopify.url}/sitemap.xml`)
      expect((await settled(read.data.async_job.id)).status).toBe("succeeded")
      const added = await upload(csv)
      expect(added.data).toEqual({ rows: 3, addresses: 2 })
      const pan = (await inventory()).find((row) => row.address === "/products/dokum-tava")
      // With and without its slash it is one address: their clicks add up
      expect(pan).toMatchObject({ clicks: 910 })
      expect(pan?.origins).toEqual(expect.arrayContaining(["sitemap", "search_console"]))

      const refused = await upload("ad,soyad\nAyşe,Kaya\n")
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("migration.search_console_invalid")
    })

    it("moves the old site's Merchant feed: variants, categories, brand, pictures, old addresses", async () => {
      await stockShop(getContainer())
      const start = (body: Record<string, unknown>) =>
        settle(
          http.post<{ async_job: SheetJob }>(
            "/admin/migrations/feed",
            { url: `${shopify.url}/feeds/merchant.xml`, ...body },
            { headers: owner.headers }
          )
        )
      const checked = await settled((await start({ mode: "check" })).data.async_job.id)
      expect(checked.status).toBe("succeeded")
      expect(
        (checked.result_summary as { counts: Record<string, Record<string, number>> }).counts
      ).toMatchObject({
        category: { read: 2, created: 3 },
        brand: { read: 1, created: 1 },
        product: { read: 2, created: 2, failed: 0 },
        image: { read: 3, created: 3 },
        customer: { read: 0 },
      })

      const parcel = { weight: 500, length: 30, width: 20, height: 10 }
      const applied = await settled(
        (await start({ mode: "apply", defaults: parcel })).data.async_job.id
      )
      expect(applied.status).toBe("succeeded")
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: ["handle", "title", "status", "weight", "images.url", "variants.sku"],
          filters: { handle: ["dokum-tava", "ahsap-kasik"] },
        })
      const products = data as {
        handle: string
        title: string
        status: string
        weight: number
        images: unknown[]
        variants: { sku: string }[]
      }[]
      expect(
        products
          .map((product) => [
            product.handle,
            product.title,
            product.status,
            product.images.length,
            product.variants.length,
          ])
          .sort()
      ).toEqual([
        ["ahsap-kasik", "Ahşap Kaşık", "published", 1, 1],
        ["dokum-tava", "Döküm Tava", "published", 2, 2],
      ])
      expect((await inventory()).map((row) => row.address).sort()).toEqual([
        "/ahsap-kasik.html",
        "/urun/dokum-tava",
      ])
    })
  },
})

import { randomBytes } from "node:crypto"
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

jest.setTimeout(300 * 1000)

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
  },
})

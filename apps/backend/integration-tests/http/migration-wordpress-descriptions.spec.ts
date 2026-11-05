import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { wordpressRecords } from "../../src/lib/migration/sources/wordpress"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import { fillSummaries } from "../../src/workflows/migration/summaries"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"

jest.setTimeout(600 * 1000)

type Counts = Record<string, Record<string, number>>

interface Pan {
  id: string
  title: string
  status: string
  description: string | null
  seo_meta: { seo_description: string | null } | null
  variants: { sku: string | null; prices: { amount: number | string }[] }[]
  product_extension: { description_doc: unknown } | null
}

/** adr/0055: a WordPress product's body as its description document, and a run that refreshes only that. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    const { settled } = sheetClient(http, getContainer, () => owner.headers)
    let server: Server
    let site = ""

    const run = async (body: string, query: string) => {
      const queued = await settle(
        http.post<{ async_job: SheetJob; message?: string }>(
          `/admin/migrations?source=wordpress&${query}`,
          Buffer.from(body),
          { headers: { ...owner.headers, "content-type": "application/xml" } }
        )
      )
      expect(queued.status).toBe(202)
      const job = await settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      return job.result_summary as { counts: Counts; refresh?: string[]; wordpress?: unknown }
    }
    const pan = async () => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: [
            "id",
            "title",
            "status",
            "description",
            "seo_meta.seo_description",
            "variants.sku",
            "variants.prices.amount",
            "product_extension.description_doc",
          ],
          filters: { handle: "dokum-tava" },
        })
      return data[0] as unknown as Pan
    }

    beforeAll(async () => {
      const png = await sharp({
        create: { width: 40, height: 40, channels: 3, background: "#2e6bb0" },
      })
        .png()
        .toBuffer()
      server = createServer((req, res) => {
        if ((req.url ?? "").endsWith(".png")) {
          res.writeHead(200, { "content-type": "image/png" })
          res.end(png)
          return
        }
        res.writeHead(404)
        res.end()
      })
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
      site = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
      process.env["SHOPIFY_BASE_URL"] = site
    })

    afterAll(async () => {
      Reflect.deleteProperty(process.env, "SHOPIFY_BASE_URL")
      await new Promise((resolve) => server.close(resolve))
    })

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
      await stockShop(getContainer())
    })

    it("moves bodies as documents, then refreshes only the descriptions of what it moved", async () => {
      const wxr = wxrFixture(site)
      // Two products have a body (one its excerpt); two have none
      const checked = await run(wxr, "mode=check")
      expect(checked.counts["product"]).toMatchObject({ created: 4, documents: 2 })
      const applied = await run(wxr, "mode=apply")
      expect(applied.counts["product"]).toMatchObject({ created: 4, failed: 0, documents: 2 })

      const moved = await pan()
      const doc = moved.product_extension?.description_doc as { content: { type: string }[] }
      expect(doc.content.map((block) => block.type)).toEqual(["heading", "bulletList", "table"])
      expect(moved.description).toBe(
        "Özellikler\n\nDöküm gövde\n24 ve 28 cm\n\nÖlçü · 28 cm\nAğırlık · 1,5 kg"
      )

      // The shop changes the product since: none of it is the refresh's to touch
      await http.post(
        `/admin/products/${moved.id}`,
        { title: "Döküm Tava (yeni)", status: "draft" },
        { headers: owner.headers }
      )
      const before = await pan()

      const changed = wxr.replace("<li>24 ve 28 cm</li>", "<li>24, 26 ve 28 cm</li>")
      // A dry run counts, writes nothing
      const dry = await run(changed, "mode=check&refresh=descriptions")
      expect(dry.refresh).toEqual(["descriptions"])
      expect(dry.counts["product"]).toMatchObject({ read: 4, updated: 1, found: 1, skipped: 2 })
      expect((await pan()).description).toBe(before.description)

      const refreshed = await run(changed, "mode=apply&refresh=descriptions")
      expect(refreshed.wordpress).toBeUndefined()
      expect(refreshed.counts["product"]).toEqual({
        read: 4,
        created: 0,
        updated: 1,
        found: 1,
        skipped: 2,
        failed: 0,
        documents: 1,
      })
      // Nothing else moved in again: every other kind counts nothing
      expect(refreshed.counts["category"]).toMatchObject({ read: 0, created: 0 })
      expect(refreshed.counts["post"]).toMatchObject({ read: 0, created: 0 })

      const after = await pan()
      expect(after.description).toBe(
        "Özellikler\n\nDöküm gövde\n24, 26 ve 28 cm\n\nÖlçü · 28 cm\nAğırlık · 1,5 kg"
      )
      expect(JSON.stringify(after.product_extension?.description_doc)).toContain("24, 26 ve 28 cm")
      expect({ ...after, description: null, product_extension: null }).toEqual({
        ...before,
        description: null,
        product_extension: null,
      })

      // Again, the same export: already the same
      const again = await run(changed, "mode=apply&refresh=descriptions")
      expect(again.counts["product"]).toMatchObject({ updated: 0, found: 2, skipped: 2 })
    })

    it("moves the excerpt as the short description, and fills an empty one later", async () => {
      const wxr = wxrFixture(site)
      const applied = await run(wxr, "mode=apply")
      // adr/0055 Ek 2026-11-05: one product of the export has an excerpt
      expect(applied.counts["product"]).toMatchObject({ created: 4, summaries: 1 })
      const spoon = async () => {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "product",
            fields: ["id", "product_extension.summary"],
            filters: { handle: "ahsap-kasik" },
          })
        return data[0] as unknown as { id: string; product_extension: { summary: string[] | null } }
      }
      const moved = await spoon()
      expect(moved.product_extension.summary).toEqual(["El yapımı kaşık"])

      // A shop whose products moved before the excerpt was read: the lines are not there
      await http.post(
        `/admin/products/${moved.id}/catalog`,
        { summary: null },
        { headers: owner.headers }
      )
      const records = wordpressRecords(wxr)
      const container = getContainer()
      const dry = await fillSummaries(container, records.id, records.products, false)
      expect(dry).toMatchObject({ read: 4, updated: 1, found: 0, empty: 3, failed: 0 })
      expect((await spoon()).product_extension.summary ?? []).toEqual([])

      const filled = await fillSummaries(container, records.id, records.products, true)
      expect(filled).toMatchObject({ updated: 1, failed: 0 })
      expect((await spoon()).product_extension.summary).toEqual(["El yapımı kaşık"])

      // Again: found, and the shop's own lines are never written over
      await http.post(
        `/admin/products/${moved.id}/catalog`,
        { summary: ["Kayın ağacı"] },
        { headers: owner.headers }
      )
      const again = await fillSummaries(container, records.id, records.products, true)
      expect(again).toMatchObject({ updated: 0, found: 1 })
      expect((await spoon()).product_extension.summary).toEqual(["Kayın ağacı"])
    })

    it("refreshes from a WordPress export only", async () => {
      const refused = await settle(
        http.post<{ message?: string }>(
          "/admin/migrations?source=bundle&mode=apply&refresh=descriptions",
          Buffer.from('{"format":"quant-migration"}'),
          { headers: { ...owner.headers, "content-type": "application/json" } }
        )
      )
      expect([refused.status, refused.data.message]).toEqual([
        400,
        "migration.refresh_wordpress_only",
      ])
    })
  },
})

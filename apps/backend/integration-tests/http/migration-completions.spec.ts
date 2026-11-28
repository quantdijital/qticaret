import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import type { SheetJob } from "../helpers/sheets"
import type { Counts } from "../helpers/wordpress"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

/**
 * adr/0042 Ek 2026-11-27: the completions, each one part of what moved
 * and nothing else, safe to run again: the products' missing pictures,
 * short descriptions, category pictures; the old addresses' 301s made
 * again and listed as CSV.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const wp = wordpressFixture(http, getContainer)

    const send = async (query: string) => {
      const queued = await wp.start(Buffer.from(wxrFixture(wp.site())), query)
      expect(queued.status).toBe(202)
      const job = await wp.settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      return job.result_summary as { counts: Counts; refresh?: string[] }
    }

    it("takes one part of what moved, and nothing twice", async () => {
      await send("mode=apply")

      // Every picture stored: nothing to fetch again, no product written
      const fetched = wp.pictures.length
      const images = await send("mode=apply&refresh=images")
      expect(images.refresh).toEqual(["images"])
      expect(images.counts["image"]).toMatchObject({ created: 0, skipped: 0 })
      expect(images.counts["product"]).toMatchObject({ created: 0, updated: 0 })
      expect(wp.pictures.length).toBe(fetched)

      // The short descriptions moved with the run: found as they are
      const summaries = await send("mode=check&refresh=summaries")
      expect(summaries.counts["product"]?.["read"]).toBeGreaterThan(0)
      expect(summaries.counts["product"]).toMatchObject({ updated: 0, failed: 0 })

      const covers = await send("mode=apply&refresh=category_covers")
      expect(covers.refresh).toEqual(["category_covers"])
      expect(covers.counts["category"]?.["created"]).toBe(0)

      // The 301s made again: the owner's decisions are not touched
      const plain = await settle(
        http.post("/admin/migrations/urls/rebuild", {}, { headers: { ...wp.headers() } })
      )
      expect(plain.status).toBe(202)
      const rebuilt = await wp.settled((plain.data as { async_job: SheetJob }).async_job.id)
      expect(rebuilt.status).toBe("succeeded")
      expect((rebuilt.result_summary as { counts: Record<string, number> }).counts).toMatchObject({
        sources: 1,
      })

      const csv = await http.get<string>("/admin/migrations/urls/export", {
        headers: wp.headers(),
        responseType: "text",
      })
      expect(csv.status).toBe(200)
      expect(String(csv.headers["content-type"])).toContain("text/csv")
      expect(csv.data).toContain("Eski adres;Yeni adres;Yanıt")
    })

    it("refuses a completion a store or a feed cannot give", async () => {
      const shopify = await settle(
        http.post(
          "/admin/migrations/shopify",
          { mode: "check", refresh: "summaries" },
          { headers: wp.headers() }
        )
      )
      expect(shopify.status).toBe(400)
      const bundle = await settle(
        http.post("/admin/migrations?mode=check&refresh=images", Buffer.from("{}"), {
          headers: { ...wp.headers(), "content-type": "application/json" },
        })
      )
      expect(bundle.status).toBe(400)
    })
  },
})

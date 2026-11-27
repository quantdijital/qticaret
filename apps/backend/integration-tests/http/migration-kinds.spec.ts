import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import type { HttpClient } from "../helpers/http"
import type { Counts } from "../helpers/wordpress"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

interface Summary {
  counts: Counts
  kinds: string[]
  added_kinds: string[]
  problems: { kind: string; key: string; count: number; samples: string[] }[]
}

interface Overview {
  last_run: { id: string; mode: string } | null
  kinds: Record<string, { moved: number; problems: number }>
  missing: Record<string, number>
  addresses: { total: number; undecided: number }
}

/**
 * adr/0042 Ek 2026-11-27: a run moves only the kinds the owner ticked
 * (with what they need), keeps its live step beside its counts and its
 * problems by reason; the overview counts what moved without a file.
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
      return { id: job.id, summary: job.result_summary as unknown as Summary }
    }
    const overview = async () => {
      const response = await http.get<{ overview: Overview }>("/admin/migrations/overview", {
        headers: wp.headers(),
      })
      expect(response.status).toBe(200)
      return response.data.overview
    }

    it("moves only the chosen kinds and what they need", async () => {
      const empty = await overview()
      expect(empty.last_run).toBeNull()
      expect(empty.kinds).toEqual({})

      const posts = await send("mode=apply&kinds=post")
      expect(posts.summary.kinds).toEqual(["post"])
      expect(posts.summary.added_kinds).toEqual([])
      expect(posts.summary.counts["post"]?.["created"]).toBeGreaterThan(0)
      // Not taken: nothing read
      expect(posts.summary.counts["product"]).toMatchObject({ read: 0, created: 0 })
      expect(posts.summary.counts["customer"]).toMatchObject({ read: 0 })
      expect(Array.isArray(posts.summary.problems)).toBe(true)

      // The run as its job names it, with its live step
      const runs = await http.get<{ runs: { job_id: string; counts: Counts }[] }>(
        `/admin/migrations?job_id=${posts.id}`,
        { headers: wp.headers() }
      )
      expect(runs.data.runs).toHaveLength(1)
      expect(runs.data.runs[0]?.counts["_phase"]).toMatchObject({ kinds: ["post"] })

      const afterPosts = await overview()
      expect(afterPosts.last_run?.mode).toBe("apply")
      expect(afterPosts.kinds["post"]?.moved).toBeGreaterThan(0)
      expect(afterPosts.kinds["product"]).toBeUndefined()

      // Pictures need their products, which need their categories and brands
      const pictures = await send("mode=check&kinds=image")
      expect(pictures.summary.kinds).toEqual(["category", "brand", "product", "image"])
      expect(pictures.summary.added_kinds).toEqual(["category", "brand", "product"])
      expect(pictures.summary.counts["image"]?.["read"]).toBeGreaterThan(0)
      expect(pictures.summary.counts["post"]).toMatchObject({ read: 0 })

      const all = await send("mode=apply")
      expect(all.summary.kinds).toContain("url")
      const after = await overview()
      expect(after.kinds["product"]?.moved).toBeGreaterThan(0)
      expect(after.missing["descriptions"]).toBe(after.kinds["product"]?.moved)
      expect(after.addresses.total).toBeGreaterThan(0)
    })

    it("refuses a kind it does not know", async () => {
      const queued = await wp.start(Buffer.from(wxrFixture(wp.site())), "mode=check&kinds=coupon")
      expect(queued.status).toBe(400)
    })
  },
})

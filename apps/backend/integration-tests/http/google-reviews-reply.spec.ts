import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGoogle } from "@qticaret/testing"
import type { FakeBusinessReview, FakeGoogle } from "@qticaret/testing"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Row {
  id: string
  author: string | null
  rating: number
  replied: boolean
  reply: string | null
  replied_at: string | null
  reply_state: string | null
}

interface StoreReviews {
  google_reviews: {
    rating: number | null
    count: number
    reviews: {
      author: string | null
      rating: number
      comment: string | null
      reply: { comment: string; created_at: string | null } | null
    }[]
  } | null
}

type Section = Record<string, unknown> & { id: string; type: string }

const ENV = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_BASE_URL"] as const

/**
 * adr/0058 Ek 2026-11-06: the shop replies to a Google review from the
 * panel (Business Profile API v4 `updateReply`/`deleteReply`), audited and
 * kept as Google answers; the storefront shows the reply Google shows;
 * the home page's rating badge reads Google's figures and excerpts.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let google: FakeGoogle
    let original: Map<string, FakeBusinessReview[]>
    let admin: { headers: Record<string, string> }
    let storefront: Storefront

    const connect = async () => {
      const { data } = await http.post<{ url: string }>(
        "/admin/google/reviews/connect",
        {},
        { headers: admin.headers }
      )
      const back = new URL(await google.consent(data.url))
      await fetch(`${base()}${back.pathname}${back.search}`, {
        redirect: "manual",
        headers: admin.headers,
      })
    }
    const rows = async () =>
      (
        await http.get<{ reviews: Row[] }>("/admin/google/reviews/items", {
          headers: admin.headers,
        })
      ).data.reviews
    const byAuthor = async (author: string) => {
      const row = (await rows()).find((each) => each.author === author)
      if (!row) {
        throw new Error(`no review by ${author}`)
      }
      return row
    }
    const reply = (id: string, body: Record<string, unknown>) =>
      settle(
        http.post<{ message?: string; reply?: Row }>(
          `/admin/google/reviews/items/${id}/reply`,
          body,
          { headers: admin.headers }
        )
      )
    const unreply = (id: string) =>
      settle(
        http.delete<{ message?: string }>(`/admin/google/reviews/items/${id}/reply`, {
          headers: admin.headers,
        })
      )
    const shown = async (query = "limit=20") =>
      (
        await http.get<StoreReviews>(`/store/google-reviews?${query}`, {
          headers: storefront.headers,
        })
      ).data.google_reviews
    const onGoogle = (reviewId: string) =>
      [...google.business.reviews.values()].flat().find((each) => each.reviewId === reviewId)
    const audits = (id: string, count: number) =>
      eventually(
        async () =>
          (
            await getContainer()
              .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
              .listAuditEntries(
                { resource_type: "google_review", resource_id: id },
                { order: { created_at: "ASC" } }
              )
          ).filter((entry) => entry.outcome === 200),
        (entries) => entries.length >= count
      )

    beforeAll(async () => {
      google = await startFakeGoogle()
      original = new Map([...google.business.reviews].map(([key, list]) => [key, [...list]]))
      Object.assign(process.env, {
        GOOGLE_OAUTH_CLIENT_ID: google.client.clientId,
        GOOGLE_OAUTH_CLIENT_SECRET: google.client.clientSecret,
        GOOGLE_BASE_URL: google.url,
      })
    })

    afterAll(async () => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await google.close()
    })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      storefront = await createStorefront(getContainer())
      google.business.approved = true
      google.business.replyState = "APPROVED"
      google.business.replyRefusal = null
      google.business.replyCalls.length = 0
      google.business.reviews = new Map([...original].map(([key, list]) => [key, [...list]]))
      await connect()
    })

    it("writes, rewrites and removes the shop's reply at Google, audited, shown as Google shows it", async () => {
      const zeynep = await byAuthor("Zeynep Arslan")
      const first = await reply(zeynep.id, {
        comment: "Teşekkür ederiz Zeynep Hanım!\nYine bekleriz.",
      })
      const afterFirst = await byAuthor("Zeynep Arslan")
      const storeFirst = await shown()
      const second = await reply(zeynep.id, { comment: "Güzel puanınız için teşekkürler." })
      const removed = await unreply(zeynep.id)
      const afterRemoved = await byAuthor("Zeynep Arslan")
      const storeRemoved = await shown()
      const entries = await audits(zeynep.id, 3)

      expect(zeynep).toMatchObject({ replied: false, reply: null, reply_state: null })
      expect(first.status).toBe(200)
      expect(first.data.reply).toMatchObject({
        reply: "Teşekkür ederiz Zeynep Hanım!\nYine bekleriz.",
        reply_state: "approved",
      })
      expect(afterFirst).toMatchObject({
        replied: true,
        reply: "Teşekkür ederiz Zeynep Hanım!\nYine bekleriz.",
        reply_state: "approved",
      })
      expect(afterFirst.replied_at).toEqual(expect.any(String))
      expect(
        storeFirst?.reviews.find((each) => each.author === "Zeynep Arslan")?.reply?.comment
      ).toBe("Teşekkür ederiz Zeynep Hanım!\nYine bekleriz.")
      expect(second.status).toBe(200)
      expect(removed.status).toBe(200)
      expect(afterRemoved).toMatchObject({ replied: false, reply: null, reply_state: null })
      expect(
        storeRemoved?.reviews.find((each) => each.author === "Zeynep Arslan")?.reply
      ).toBeNull()
      expect(google.business.replyCalls.map((call) => call.method)).toEqual([
        "PUT",
        "PUT",
        "DELETE",
      ])
      const fakeId = google.business.replyCalls[0]?.reviewId ?? ""
      expect(onGoogle(fakeId)?.reviewReply).toBeUndefined()
      // Who and what changed: whether there is a reply, its length and state, never its words
      expect(entries.map((entry) => entry.action)).toEqual([
        "POST /admin/google/reviews/items/:id/reply",
        "POST /admin/google/reviews/items/:id/reply",
        "DELETE /admin/google/reviews/items/:id/reply",
      ])
      expect(entries[0]?.changes).toMatchObject({
        diff: {
          replied: { before: false, after: true },
          reply_state: { before: null, after: "approved" },
        },
      })
      expect(JSON.stringify(entries)).not.toContain("Zeynep Hanım")
    })

    it("keeps a reply Google is still moderating for the panel, off the storefront until approved", async () => {
      google.business.replyState = "PENDING"
      const emre = await byAuthor("Emre Yıldız")
      const answered = await reply(emre.id, { comment: "Yeni kutularımız daha sağlam." })
      const row = await byAuthor("Emre Yıldız")
      const store = await shown()
      // Approved on Google later: the next sync brings it in
      const fakeId = google.business.replyCalls[0]?.reviewId ?? ""
      const review = onGoogle(fakeId)
      if (review?.reviewReply) {
        review.reviewReply.reviewReplyState = "APPROVED"
      }
      await http.post("/admin/google/reviews/sync", {}, { headers: admin.headers })
      const synced = await shown()

      expect(answered.status).toBe(200)
      expect(row).toMatchObject({ reply: "Yeni kutularımız daha sağlam.", reply_state: "pending" })
      expect(store?.reviews.find((each) => each.author === "Emre Yıldız")?.reply).toBeNull()
      expect(synced?.reviews.find((each) => each.author === "Emre Yıldız")?.reply?.comment).toBe(
        "Yeni kutularımız daha sağlam."
      )
    })

    it("brings in a reply written on Google directly at the next sync", async () => {
      const ayse = await byAuthor("Ayşe Demir")
      // A new object in the list: the originals stay as they are for the next test
      for (const list of google.business.reviews.values()) {
        const at = list.findIndex((each) => each.reviewer.displayName === "Ayşe Demir")
        const found = list[at]
        if (found) {
          list[at] = {
            ...found,
            reviewReply: {
              comment: "Babanıza iyi günlerde kullanmasını dileriz.",
              updateTime: new Date().toISOString(),
              reviewReplyState: "APPROVED",
            },
          }
        }
      }
      await http.post("/admin/google/reviews/sync", {}, { headers: admin.headers })
      const row = await byAuthor("Ayşe Demir")

      expect(ayse.reply).toBeNull()
      expect(row).toMatchObject({
        replied: true,
        reply: "Babanıza iyi günlerde kullanmasını dileriz.",
        reply_state: "approved",
      })
      expect(google.business.replyCalls).toHaveLength(0)
    })

    it("refuses an empty reply, one over Google's 4096 bytes, and Google's refusals, changing nothing", async () => {
      const mehmet = await byAuthor("Mehmet Kaya")
      const empty = await reply(mehmet.id, { comment: "   " })
      // 2100 Turkish letters: under 4096 characters, over 4096 bytes
      const long = await reply(mehmet.id, { comment: "ş".repeat(2100) })
      const extra = await reply(mehmet.id, { comment: "Teşekkürler", rating: 5 })
      google.business.replyRefusal = { status: 403, word: "PERMISSION_DENIED" }
      const forbidden = await reply(mehmet.id, { comment: "Teşekkürler" })
      google.business.replyRefusal = null
      google.business.approved = false
      const unapproved = await reply(mehmet.id, { comment: "Teşekkürler" })
      google.business.approved = true
      const unknown = await reply("grev_01JYOKBOYLEBIRYORUM00000", { comment: "Teşekkürler" })
      const after = await byAuthor("Mehmet Kaya")

      expect([empty.status, empty.data.message]).toEqual([400, "google.reply_required"])
      expect([long.status, long.data.message]).toEqual([400, "google.reply_too_long"])
      expect(extra.status).toBe(400)
      expect([forbidden.status, forbidden.data.message]).toEqual([400, "google.reply_forbidden"])
      expect([unapproved.status, unapproved.data.message]).toEqual([
        400,
        "google.reply_unavailable",
      ])
      expect([unknown.status, unknown.data.message]).toEqual([400, "google.review_not_found"])
      expect(google.business.replyCalls).toHaveLength(0)
      expect(after).toMatchObject({ reply: mehmet.reply, reply_state: mehmet.reply_state })
    })

    it("refuses removing a reply that is not there", async () => {
      const zeynep = await byAuthor("Zeynep Arslan")
      const removed = await unreply(zeynep.id)

      expect([removed.status, removed.data.message]).toEqual([400, "google.reply_missing"])
      expect(google.business.replyCalls).toHaveLength(0)
    })

    it("gives the rating badge Google's figures and recent 4-5 star excerpts with text, never hidden ones", async () => {
      const figures = await shown("limit=0")
      const excerpts = await shown("limit=3&min_rating=4")
      const mehmet = await byAuthor("Mehmet Kaya")
      await settle(
        http.post(
          `/admin/google/reviews/items/${mehmet.id}`,
          { hidden: true, reason: "personal_data" },
          { headers: admin.headers }
        )
      )
      const afterHide = await shown("limit=3&min_rating=4")
      const wrong = await settle(
        http.get(`/store/google-reviews?limit=3&min_rating=6`, { headers: storefront.headers })
      )

      expect(figures).toMatchObject({ rating: expect.any(Number) as unknown, reviews: [] })
      expect(figures?.count).toBeGreaterThan(0)
      expect(excerpts?.reviews).toHaveLength(3)
      for (const review of excerpts?.reviews ?? []) {
        expect(review.rating).toBeGreaterThanOrEqual(4)
        expect(review.comment).not.toBeNull()
      }
      expect(excerpts?.reviews[0]?.author).toBe("Mehmet Kaya")
      expect(afterHide?.reviews.some((each) => each.author === "Mehmet Kaya")).toBe(false)
      // Google's figures stay Google's
      expect([afterHide?.rating, afterHide?.count]).toEqual([excerpts?.rating, excerpts?.count])
      expect(wrong.status).toBe(400)
    })

    it("publishes the badge section in the store layout with its options only", async () => {
      const owner = { headers: admin.headers }
      const badge: Section = {
        id: "googlepuan",
        type: "google_rating",
        visible: true,
        starts_at: null,
        ends_at: null,
        title: null,
        excerpts: 2,
        profile_link: false,
      }
      const saved = await settle(
        http.post(
          "/admin/storefront-layout",
          { document: { header: [], home: [badge], footer: [], product: [], category: [] } },
          owner
        )
      )
      const tooMany = await settle(
        http.post<{ message?: string }>(
          "/admin/storefront-layout",
          {
            document: {
              header: [],
              home: [{ ...badge, excerpts: 4 }],
              footer: [],
              product: [],
              category: [],
            },
          },
          owner
        )
      )
      await settle(http.post("/admin/storefront-layout/publish", {}, owner))
      const live = await settle(
        http.get<{ layout: { home: Section[] } }>("/store/storefront-layout", {
          headers: storefront.headers,
        })
      )

      expect(saved.status).toBe(200)
      expect(tooMany.status).toBe(400)
      expect(live.data.layout.home).toEqual([
        { id: "googlepuan", type: "google_rating", title: null, excerpts: 2, profile_link: false },
      ])
    })
  },
})

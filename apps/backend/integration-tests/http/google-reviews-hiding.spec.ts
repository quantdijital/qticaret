import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGoogle } from "@qticaret/testing"
import type { FakeGoogle } from "@qticaret/testing"
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
  hidden: boolean
  hidden_reason: string | null
  hidden_by: string | null
  hidden_at: string | null
}

const ENV = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_BASE_URL"] as const

/**
 * adr/0058 Ek (the owner, 2026-11-05): a Google review leaves the
 * storefront only for personal data, abuse or being off topic, one at a
 * time, audited; never for its stars, and Google's figures stay Google's.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let google: FakeGoogle
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
    const hide = (id: string, body: Record<string, unknown>) =>
      settle(
        http.post<{ message?: string }>(`/admin/google/reviews/items/${id}`, body, {
          headers: admin.headers,
        })
      )
    const shown = async () =>
      (
        await http.get<{
          google_reviews: {
            rating: number
            count: number
            reviews: { author: string | null }[]
          } | null
        }>("/store/google-reviews?limit=20", { headers: storefront.headers })
      ).data.google_reviews
    /** The changes made to a review, as the audit log keeps them (refused attempts aside). */
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
      await connect()
    })

    it("takes a review off only with one of the three reasons, never without or for its stars", async () => {
      const okan = (await rows()).find((each) => each.author === "Okan Koç")
      const id = okan?.id ?? ""
      const bare = await hide(id, { hidden: true })
      const byStars = await hide(id, { hidden: true, reason: "negative" })
      const free = await hide(id, { hidden: true, reason: "abusive", note: "puanı düşük" })
      const after = (await rows()).find((each) => each.id === id)

      expect(okan?.rating).toBe(2)
      expect([bare.status, bare.data.message]).toEqual([400, "google.hide_reason_required"])
      expect([byStars.status, byStars.data.message]).toEqual([400, "google.hide_reason_invalid"])
      expect(free.status).toBe(400)
      expect(after).toMatchObject({ hidden: false, hidden_reason: null })
    })

    it("refuses many at once: no list of ids, no route for the whole list", async () => {
      const ids = (await rows()).slice(0, 3).map((each) => each.id)
      const listed = await hide(ids[0] ?? "", { hidden: true, reason: "off_topic", ids })
      const whole = await settle(
        http.post(
          "/admin/google/reviews/items",
          { ids, hidden: true, reason: "off_topic" },
          { headers: admin.headers }
        )
      )

      expect(listed.status).toBe(400)
      expect(whole.status).toBe(404)
      expect((await rows()).filter((each) => each.hidden)).toHaveLength(0)
    })

    it("hides with the reason, who and when, audited; puts back clearing them; Google's figures stay", async () => {
      const before = await shown()
      const mehmet = (await rows()).find((each) => each.author === "Mehmet Kaya")
      const id = mehmet?.id ?? ""
      const hidden = await hide(id, { hidden: true, reason: "personal_data" })
      const afterHide = (await rows()).find((each) => each.id === id)
      const storeAfterHide = await shown()
      const unexpected = await hide(id, { hidden: false, reason: "abusive" })
      const back = await hide(id, { hidden: false })
      const afterBack = (await rows()).find((each) => each.id === id)
      const [hideEntry, backEntry] = await audits(id, 2)

      expect(hidden.status).toBe(200)
      expect(afterHide).toMatchObject({ hidden: true, hidden_reason: "personal_data" })
      expect(afterHide?.hidden_by).toEqual(expect.any(String))
      expect(afterHide?.hidden_at).toEqual(expect.any(String))
      expect(storeAfterHide?.reviews.some((each) => each.author === "Mehmet Kaya")).toBe(false)
      // Google's average and count, never ours: hiding changes neither
      expect([storeAfterHide?.rating, storeAfterHide?.count]).toEqual([
        before?.rating,
        before?.count,
      ])
      expect([unexpected.status, unexpected.data.message]).toEqual([
        400,
        "google.hide_reason_unexpected",
      ])
      expect(back.status).toBe(200)
      expect(afterBack).toMatchObject({
        hidden: false,
        hidden_reason: null,
        hidden_by: null,
        hidden_at: null,
      })
      expect(hideEntry).toMatchObject({
        action: "POST /admin/google/reviews/items/:id",
        actor_type: "user",
        resource_type: "google_review",
        resource_id: id,
        outcome: 200,
      })
      // Before and after, the reason with them
      expect(hideEntry?.changes).toMatchObject({
        diff: {
          hidden: { before: false, after: true },
          hidden_reason: { before: null, after: "personal_data" },
        },
      })
      expect(backEntry?.changes).toMatchObject({
        diff: {
          hidden: { before: true, after: false },
          hidden_reason: { before: "personal_data", after: null },
        },
      })
    })
  },
})

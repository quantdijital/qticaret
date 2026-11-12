import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { PlanSummary } from "../../src/lib/plan-limits"
import { createAdminUser } from "../helpers/admin"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient, RequestConfig } from "../helpers/http"
import { settle } from "../helpers/http"
import { productBody, setPlanStatus } from "../helpers/plan-limits"
import { sellingShop } from "../helpers/plan-status"
import { firstLineOf } from "../helpers/stock"
import type { Answer, SellingShop } from "../helpers/plan-status"

jest.setTimeout(240 * 1000)

/**
 * adr/0061 §5.5, Ek C15: a restricted shop (its subscription overdue). The
 * panel reads; its orders' operations, stock, KVKK, exports and one's own
 * account stay open; the catalog, campaigns, settings and new staff answer
 * 403 `plan.restricted`. The storefront sells as usual.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let selling: SellingShop
    const headers = () => ({ headers: selling.admin.headers })
    const post = (url: string, body: unknown = {}) =>
      settle(http.post<Answer>(url, body, headers()))
    const get = <T>(url: string) => settle(http.get<T>(url, headers()))

    managedForThisFile()

    beforeEach(async () => {
      selling = await sellingShop(http, getContainer())
      await setPlanStatus(getContainer(), "restricted")
    })

    it("closes the catalog, campaigns, settings and new staff; reads stay open", async () => {
      const closed = [
        await post("/admin/products", productBody("Yeni", selling.shop.salesChannelId)),
        await post(`/admin/products/${selling.productId}`, { title: "Yeni ad" }),
        await post("/admin/staff/invites", {
          email: `ekip-${randomUUID()}@example.com`,
          role: "admin",
        }),
        await post("/admin/platform-settings/store", { name: "Başka" }),
        await post("/admin/promotions", { code: "YENI10", type: "standard" }),
      ]
      const reads = [
        await get("/admin/products"),
        await get("/admin/orders"),
        await get(`/admin/products/${selling.productId}`),
      ]
      const plan = await get<{ plan: PlanSummary }>("/admin/plan")

      for (const answer of closed) {
        expect(answer.status).toBe(403)
        expect(answer.data).toMatchObject({
          type: "not_allowed",
          message: "plan.restricted",
          status: "restricted",
        })
      }
      expect(reads.map((answer) => answer.status)).toEqual([200, 200, 200])
      expect(plan.status).toBe(200)
      expect(plan.data.plan).toMatchObject({ managed: true, status: "restricted" })
    })

    it("sells on the storefront and keeps the orders' operations and stock open", async () => {
      const first = await selling.checkout()
      const second = await selling.checkout()
      const firstId = first.data.order?.id ?? ""
      const secondId = second.data.order?.id ?? ""

      const confirmed = await post(`/admin/orders/${firstId}/bank-transfer/confirm`)
      const shipped = await post(`/admin/orders/${firstId}/ship`)
      const cancelled = await post(`/admin/orders/${secondId}/cancel`)
      const stock = await post(
        `/admin/inventory-items/${selling.itemId}/location-levels/${selling.shop.locationId}`,
        { stocked_quantity: 25 }
      )
      const exported = await post("/admin/order-board/export", { format: "csv" })

      expect([first.status, second.status]).toEqual([200, 200])
      expect(firstId).toMatch(/^order_/)
      expect(confirmed.status).toBe(200)
      expect(shipped.status).toBe(200)
      expect(cancelled.status).toBe(200)
      expect(stock.status).toBe(200)
      expect(exported.status).toBeLessThan(300)
      const site = await settle(
        http.get<{ suspended?: boolean }>("/store/seo/site", {
          headers: selling.storefront.headers,
        })
      )
      expect(site.data.suspended).toBe(false)
    })

    it("keeps one's own account open, and tells every role the status", async () => {
      const profile = await post("/admin/staff/me/profile", {
        first_name: "Ayşe",
        last_name: "Yılmaz",
        job_title: "Mağaza sahibi",
      })
      const operations = await createAdminUser(http, getContainer(), "operations")
      const me = await settle(
        http.get<{ role: string; plan: { status: string } }>("/admin/staff/me", {
          headers: operations.headers,
        })
      )
      const refused = await settle(
        http.post<Answer>(`/admin/orders/order_none/ship`, {}, { headers: operations.headers })
      )

      expect(profile.status).toBe(200)
      expect(me.data).toMatchObject({ role: "operations", plan: { status: "restricted" } })
      // An order route stays the order's: open to the plan, answered by the order itself
      expect(refused.data.message).not.toBe("plan.restricted")
    })

    it("keeps the stop actions open: a bulk message paused or cancelled, Google disconnected (M1)", async () => {
      const stops = [
        await post("/admin/bulk-messages/bm_none/pause"),
        await post("/admin/bulk-messages/bm_none/cancel"),
        await settle(http.delete<Answer>("/admin/google", headers())),
      ]
      const resumed = await post("/admin/bulk-messages/bm_none/resume")

      // Each answered by its own route (none here, or not connected), never by the plan
      for (const answer of stops) {
        expect(answer.data.message).not.toBe("plan.restricted")
      }
      expect(resumed.data).toMatchObject({ message: "plan.restricted" })
    })

    it("connects no Google account through the callback outside /admin (Ek C19 L2)", async () => {
      const back = await settle(
        http.get<Answer>("/google/callback?state=gst_restricted&code=4%2F0Aabc", {
          responseType: "text",
          maxRedirects: 0,
        } as RequestConfig)
      )

      expect(back.status).toBe(303)
      expect(String(back.headers["location"])).toMatch(/[?&]google=restricted$/)
    })

    it("corrects an order down but sells nothing new through an edit (review L1)", async () => {
      const placed = await selling.checkout()
      const orderId = placed.data.order?.id ?? ""
      await post(`/admin/orders/${orderId}/bank-transfer/confirm`)
      const line = await firstLineOf(getContainer(), orderId)
      const edit = (change: Record<string, unknown>, difference: number) =>
        post(`/admin/orders/${orderId}/edit`, {
          items: [],
          ...change,
          expected_difference: difference,
          difference_collected: difference > 0,
          reference: randomUUID().replace(/-/g, ""),
        })

      const added = await edit({ add: [{ variant_id: selling.variantId, quantity: 1 }] }, 120)
      const raised = await edit({ items: [{ id: line, quantity: 1, unit_price: 150 }] }, 30)
      const lowered = await edit({ items: [{ id: line, quantity: 1, unit_price: 100 }] }, -20)

      for (const answer of [added, raised]) {
        expect(answer.status).toBe(403)
        expect(answer.data).toMatchObject({ message: "plan.restricted", status: "restricted" })
      }
      // Past the plan: the order answers itself (a bank transfer's money goes back by hand)
      expect(lowered.data).toMatchObject({ message: "orders.edit_payment_unsupported" })
    })
  },
})

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { nextSerial, productBody, setPlanStatus } from "../helpers/plan-limits"
import { sellingShop } from "../helpers/plan-status"
import type { Answer, SellingShop } from "../helpers/plan-status"

jest.setTimeout(240 * 1000)

/**
 * adr/0061 §5.5, Ek C15: a shop the platform suspended. The storefront's
 * edge hears it (its 503), the Store API starts no payment and completes no cart (503
 * `plan.suspended`), the panel is restricted's; a payment already started
 * settles through its provider's hook, and the control plane's next
 * document still reaches the shop to lift it.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let selling: SellingShop
    const admin = () => ({ headers: selling.admin.headers })
    const site = async () =>
      (
        await http.get<{ suspended?: boolean }>("/store/seo/site", {
          headers: selling.storefront.headers,
        })
      ).data

    managedForThisFile()

    beforeEach(async () => {
      selling = await sellingShop(http, getContainer())
    })

    it("takes no order on the storefront; the orders it has stay open to the panel", async () => {
      const before = await selling.checkout()
      const orderId = before.data.order?.id ?? ""
      // A transfer started before the suspension, its cart not yet completed
      const started = await selling.startPayment()
      await setPlanStatus(getContainer(), "suspended")

      const newPayment = await selling.startPayment()
      const refused = await selling.complete(started.cartId)
      const created = await settle(
        http.post<Answer>(
          "/admin/products",
          productBody("Yeni", selling.shop.salesChannelId),
          admin()
        )
      )
      const confirmed = await settle(
        http.post<Answer>(`/admin/orders/${orderId}/bank-transfer/confirm`, {}, admin())
      )
      const listed = await settle(http.get("/admin/orders", admin()))

      expect(before.status).toBe(200)
      expect(started.status).toBe(200)
      // Every payment starts here, a card form too: none while suspended
      expect(newPayment.status).toBe(503)
      expect(newPayment.data).toMatchObject({ message: "plan.suspended" })
      expect(refused.status).toBe(503)
      expect(refused.retryAfter).toBe("3600")
      expect(refused.data).toMatchObject({ type: "unavailable", message: "plan.suspended" })
      expect(created.status).toBe(403)
      expect(created.data).toMatchObject({ message: "plan.restricted", status: "suspended" })
      expect(confirmed.status).toBe(200)
      expect(listed.status).toBe(200)
      expect(await site()).toMatchObject({ suspended: true })
      // Review I1: never kept on the way, so the end of a suspension is not held back
      const raw = await http.get("/store/seo/site", { headers: selling.storefront.headers })
      expect(raw.headers["cache-control"]).toBe("no-store")
    })

    it("keeps provider hooks reachable, and the control plane's next document lifts it", async () => {
      await setPlanStatus(getContainer(), "suspended")

      // An unsigned notification: the provider's own refusal, never the plan's
      const paytr = await settle(http.post<Answer>("/hooks/paytr", {}))
      const lifted = await settle(
        http.post<{ applied?: boolean }>(
          "/hooks/control-plane/plan",
          signed(doc(nextSerial(), { status: "active" }))
        )
      )
      const after = await selling.checkout()

      expect(paytr.status).toBeGreaterThanOrEqual(400)
      expect(paytr.status).toBeLessThan(500)
      expect(JSON.stringify(paytr.data)).not.toContain("plan.")
      expect(lifted.data).toMatchObject({ applied: true })
      expect(await site()).toMatchObject({ suspended: false })
      expect(after.status).toBe(200)
    })
  },
})

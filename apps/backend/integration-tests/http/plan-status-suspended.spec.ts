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
 * edge hears it (its 503), the Store API starts no payment, completes no cart and
 * builds none (503 `plan.suspended`), the panel is restricted's; a payment already started
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

    it("builds no cart while suspended, and still shows the one it has (#43 review)", async () => {
      const started = await selling.startPayment()
      await setPlanStatus(getContainer(), "suspended")
      const store = { headers: selling.storefront.headers }

      const created = await settle(http.post<Answer>("/store/carts", {}, store))
      const added = await settle(
        http.post<Answer>(
          `/store/carts/${started.cartId}/line-items`,
          { variant_id: selling.variantId, quantity: 1 },
          store
        )
      )
      const updated = await settle(
        http.post<Answer>(`/store/carts/${started.cartId}`, { email: "yeni@example.com" }, store)
      )
      const cart = (
        await settle(
          http.get<{ cart: { items: { id: string }[] } }>(`/store/carts/${started.cartId}`, store)
        )
      ).data.cart
      const lineId = cart.items[0]?.id ?? ""
      const removed = await settle(
        http.delete<Answer>(`/store/carts/${started.cartId}/line-items/${lineId}`, store)
      )
      const shipping = await settle(
        http.post<Answer>(
          `/store/carts/${started.cartId}/shipping-methods`,
          { option_id: "so_1" },
          store
        )
      )
      const coded = await settle(
        http.post<Answer>(
          `/store/carts/${started.cartId}/promotions`,
          { promo_codes: ["X"] },
          store
        )
      )
      const declared = await settle(
        http.post<Answer>(`/store/carts/${started.cartId}/age-declaration`, {}, store)
      )
      // Upper case and a trailing slash reach the same guard
      const shouted = await settle(http.post<Answer>("/STORE/CARTS/", {}, store))
      const read = await settle(http.get(`/store/carts/${started.cartId}`, store))
      // A read by POST stays open: the payment result page asks it (security review M1)
      const access = await settle(
        http.post<Answer>(`/store/carts/${started.cartId}/order-access`, {}, store)
      )

      for (const refused of [
        created,
        added,
        updated,
        removed,
        shipping,
        coded,
        declared,
        shouted,
      ]) {
        expect(refused.status).toBe(503)
        expect(refused.data).toMatchObject({ type: "unavailable", message: "plan.suspended" })
        expect(refused.headers["retry-after"]).toBe("3600")
      }
      expect(read.status).toBe(200)
      expect(access.status).not.toBe(503)
    })

    it("answers its product feeds 503 with Retry-After, as the storefront (Ek C19 L1)", async () => {
      const feed = () => settle(http.get<Answer>("/feeds/0123456789abcdef0123456789abcdef/google"))
      const open = await feed()
      await setPlanStatus(getContainer(), "suspended")
      const closed = await feed()

      // Open: a wrong token is the feed's own 404
      expect(open.status).toBe(404)
      expect(closed.status).toBe(503)
      expect(closed.headers["retry-after"]).toBe("3600")
      expect(closed.data).toMatchObject({ type: "unavailable", message: "plan.suspended" })
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

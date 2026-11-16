import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, paytrNotification, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import {
  connectPaytr,
  notifyPaytr,
  orderOfCart,
  readyCart,
  startPaytrPayment,
} from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()

interface Refusal {
  type?: string
  message?: string
}

/**
 * adr/0053 Ek 2026-11-17: while the shop is in maintenance the Store API
 * takes no sale and no form (503 `maintenance.shop_closed`, Retry-After),
 * whoever calls it directly; the catalogue still reads, a payment started
 * before still completes through its provider, the panel works, and a
 * bypass link's holder still buys.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let owner: { headers: Record<string, string> }

    const store = () => ({ headers: storefront.headers })
    const setMaintenance = async (body: Record<string, unknown>) => {
      const saved = await settle(
        http.post("/admin/platform-settings/maintenance", body, { headers: owner.headers })
      )
      if (saved.status !== 200) {
        throw new Error(`maintenance not saved: ${String(saved.status)}`)
      }
    }
    const newCart = (headers: Record<string, string> = {}) =>
      settle(
        http.post<Refusal & { cart?: { id: string } }>(
          "/store/carts",
          { region_id: shop.regionId },
          { headers: { ...storefront.headers, ...headers } }
        )
      )

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      // Read on the first PayTR call (lib/payments/paytr/client.ts)
      process.env["PAYTR_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      owner = await connectPaytr(http, container, account)
    })

    it("refuses the shopper's writes while dark and reads the catalogue as before", async () => {
      const open = await newCart()
      const soon = new Date(Date.now() + 2 * 3600 * 1000).toISOString()
      await setMaintenance({ enabled: true, expected_at: soon })

      const cart = await newCart()
      const existing = open.data.cart?.id ?? ""
      const line = await settle(
        http.post<Refusal>(
          `/store/carts/${existing}/line-items`,
          { variant_id: variantId, quantity: 1 },
          store()
        )
      )
      const completed = await settle(
        http.post<Refusal>(`/store/carts/${existing}/complete`, {}, store())
      )
      // Refused before its own validation: an empty body says nothing
      const contact = await settle(http.post<Refusal>("/store/contact-messages", {}, store()))
      const registered = await settle(
        http.post<Refusal>("/auth/customer/emailpass/register", {
          email: "yeni.musteri@example.com",
          // Throwaway, made per run: never a literal in the source
          password: randomUUID(),
        })
      )
      const products = await settle(http.get("/store/products", store()))
      const readCart = await settle(http.get(`/store/carts/${existing}`, store()))
      const site = await settle(
        http.get<{ maintenance: { enabled: boolean } }>("/store/seo/site", store())
      )
      // Read by POST: the payment result page asks it (no order yet: its own 404)
      const access = await settle(
        http.post<Refusal>(`/store/carts/${existing}/order-access`, {}, store())
      )
      // The panel works, and turns the shop on again
      const adminRead = await settle(http.get("/admin/products", { headers: owner.headers }))
      await setMaintenance({ enabled: false })
      const after = await newCart()

      expect(open.status).toBe(200)
      for (const refused of [cart, line, completed, contact, registered]) {
        expect(refused.status).toBe(503)
        expect(refused.data).toMatchObject({
          type: "unavailable",
          message: "maintenance.shop_closed",
        })
        const seconds = Number(refused.headers["retry-after"])
        expect(seconds).toBeGreaterThan(7000)
        expect(seconds).toBeLessThanOrEqual(7200)
        expect(refused.headers["cache-control"]).toBe("no-store")
      }
      expect(products.status).toBe(200)
      expect(readCart.status).toBe(200)
      expect(site.status).toBe(200)
      expect(site.data.maintenance.enabled).toBe(true)
      expect(access.status).not.toBe(503)
      expect(adminRead.status).toBe(200)
      expect(after.status).toBe(200)
    })

    it("still places the order of a payment started before the shop went dark", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const merchantOid = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(merchantOid)
      await setMaintenance({ enabled: true })

      const notified = await notifyPaytr(
        http,
        paytrNotification(account, {
          merchantOid,
          status: "success",
          paymentAmount: 21000,
          testMode: true,
        })
      )
      const order = await orderOfCart(getContainer(), cartId)
      const access = await settle(
        http.post<{ order_id?: string }>(`/store/carts/${cartId}/order-access`, {}, store())
      )
      // A new payment on another cart is refused
      const other = await readyCart(getContainer(), shop, variantId)
      const refused = await settle(
        http.post<Refusal>(`/store/carts/${other}/payment-session`, {}, store())
      )

      expect(notified.status).toBe(200)
      expect(notified.data).toBe("OK")
      expect(order).toMatch(/^order_/)
      expect(access.status).toBe(200)
      expect(access.data.order_id).toBe(order)
      expect(refused.status).toBe(503)
      expect(refused.data).toMatchObject({ message: "maintenance.shop_closed" })
    })

    it("lets a bypass link's holder buy, only with a link the shop signed for the section as saved", async () => {
      await setMaintenance({ enabled: true })
      const link = await settle(
        http.post<{ path: string }>("/admin/maintenance/bypass", {}, { headers: owner.headers })
      )
      const token = new URL(link.data.path, "https://magaza.test").searchParams.get("t") ?? ""
      const [id = "", expires = ""] = token.split(".")
      const admin = await createAdminUser(http, getContainer(), "admin")

      const withLink = await newCart({ "x-maintenance-bypass": token })
      const forged = await newCart({ "x-maintenance-bypass": `${id}.${expires}.${"A".repeat(43)}` })
      const anything = await newCart({ "x-maintenance-bypass": "1" })
      // Any save of the section ends the links made before it
      await setMaintenance({ title: "Bakımdayız" })
      const afterSave = await newCart({ "x-maintenance-bypass": token })
      // An admin's own link opens it again
      const fresh = await settle(
        http.post<{ path: string }>("/admin/maintenance/bypass", {}, { headers: admin.headers })
      )
      const freshToken = new URL(fresh.data.path, "https://magaza.test").searchParams.get("t") ?? ""
      const withFresh = await newCart({ "x-maintenance-bypass": freshToken })

      expect(link.status).toBe(200)
      expect(withLink.status).toBe(200)
      expect([forged.status, anything.status, afterSave.status]).toEqual([503, 503, 503])
      expect(withFresh.status).toBe(200)
    })
  },
})

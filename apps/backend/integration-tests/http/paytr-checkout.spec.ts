import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  createRegionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import paytrRegionProvider from "../../src/migration-scripts/paytr-region-provider"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS, connectPaytr, readyCart, storeReturnUrls } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()
const PERSONAL = /ayse\.yilmaz@example\.com|05320000000|Atatürk Cad/

interface Session {
  id: string
  provider_id: string
  status: string
  data: Record<string, unknown>
}

/** F5 V2 (adr/0026): a hosted PayTR payment starts from our Store route only. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    const start = (cartId: string, body: Record<string, unknown> = {}) =>
      settle(
        http.post<{ payment_session: Session }>(
          `/store/carts/${cartId}/payment-session`,
          { provider_id: PAYTR_PAYMENT_PROVIDER_ID, return_urls: storeReturnUrls(), ...body },
          { headers: storefront.headers }
        )
      )
    const tokenRequests = () =>
      fake.requests.filter((request) => request.path === "/odeme/api/get-token")

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
      // Carts take Turkish addresses checked against the list (F1.4)
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      fake.requests.length = 0
    })

    const connect = () => connectPaytr(http, getContainer(), account)

    it("says the shop has no PayTR account before one is connected", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)

      const started = await start(cartId)

      expect(started.status).toBe(400)
      expect(started.data).toMatchObject({ message: "paytr.not_configured" })
      expect(tokenRequests()).toHaveLength(0)
    })

    it("starts a payment from the stored cart; the session shows nothing personal", async () => {
      await connect()
      const cartId = await readyCart(getContainer(), shop, variantId)

      const started = await start(cartId)
      const cart = await http.get<{
        cart: { payment_collection: { payment_sessions: unknown[] } }
      }>(`/store/carts/${cartId}?fields=*payment_collection.payment_sessions`, {
        headers: storefront.headers,
      })

      expect(started.status).toBe(200)
      expect(started.data.payment_session).toMatchObject({
        provider_id: PAYTR_PAYMENT_PROVIDER_ID,
        status: "pending",
        data: { checkout: null, amount: 21000, currency_code: "try", test_mode: true },
      })
      const sessions = cart.data.cart.payment_collection.payment_sessions
      expect(sessions).toHaveLength(1)
      expect(JSON.stringify([started.data, sessions])).not.toMatch(PERSONAL)
      const sent = tokenRequests()[0]?.fields
      expect(sent).toMatchObject({
        merchant_oid: started.data.payment_session.id.replaceAll("_", ""),
        payment_amount: "21000",
        email: "ayse.yilmaz@example.com",
        user_phone: "05320000000",
      })
    })

    it("replaces the session when the payment starts again", async () => {
      await connect()
      const cartId = await readyCart(getContainer(), shop, variantId)

      const first = await start(cartId)
      const second = await start(cartId)
      const cart = await http.get<{
        cart: { payment_collection: { payment_sessions: Session[] } }
      }>(`/store/carts/${cartId}?fields=*payment_collection.payment_sessions`, {
        headers: storefront.headers,
      })

      expect(second.data.payment_session.id).not.toBe(first.data.payment_session.id)
      expect(cart.data.cart.payment_collection.payment_sessions.map(({ id }) => id)).toEqual([
        second.data.payment_session.id,
      ])
    })

    it("places the order once PayTR has taken the money, and not before", async () => {
      await connect()
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await start(cartId)
      const complete = () =>
        settle(
          http.post<{ type: string; order?: { id: string } }>(
            `/store/carts/${cartId}/complete`,
            {},
            { headers: storefront.headers }
          )
        )

      const early = await complete()
      fake.pay(String(started.data.payment_session.data["merchant_oid"]))
      const paid = await complete()

      expect(early.data.type).not.toBe("order")
      expect(paid.data).toMatchObject({ type: "order" })
    })

    it("refuses Medusa's own session route, a foreign return address and a cart not ready", async () => {
      await connect()
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const started = await start(cartId)
      const withoutPhone = Object.fromEntries(
        Object.entries(PAYTR_ADDRESS).filter(([field]) => field !== "phone")
      )
      const noPhone = await readyCart(container, shop, variantId, withoutPhone)
      fake.requests.length = 0
      const collectionId = (
        await http.get<{ cart: { payment_collection: { id: string } } }>(
          `/store/carts/${cartId}?fields=payment_collection.id`,
          { headers: storefront.headers }
        )
      ).data.cart.payment_collection.id

      const core = await settle(
        http.post(
          `/store/payment-collections/${collectionId}/payment-sessions`,
          {
            provider_id: PAYTR_PAYMENT_PROVIDER_ID,
            data: { checkout: { email: "x@example.com" } },
          },
          { headers: storefront.headers }
        )
      )
      const foreign = await start(cartId, {
        return_urls: { success: "https://evil.example.com/", failure: "https://evil.example.com/" },
      })
      const missingPhone = await start(noPhone)

      expect(started.status).toBe(200)
      expect(core.status).toBe(400)
      expect(core.data).toMatchObject({ message: "payments.use_checkout_route" })
      expect(foreign.status).toBe(400)
      expect(foreign.data).toMatchObject({ message: "payments.return_url_invalid" })
      expect(missingPhone.status).toBe(400)
      expect(missingPhone.data).toMatchObject({ message: "cart.phone_required" })
      expect(tokenRequests()).toHaveLength(0)
    })

    it("adds PayTR to a region made before it, keeping the providers it had", async () => {
      const container = getContainer()
      const { result } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: "Almanya",
              currency_code: "eur",
              countries: ["de"],
              payment_providers: ["pp_system_default"],
            },
          ],
        },
      })
      const providersOf = async (id: string) => {
        const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "region",
          fields: ["payment_providers.id"],
          filters: { id },
        })
        const region = data[0] as { payment_providers?: { id: string }[] } | undefined
        return (region?.payment_providers ?? []).map((provider) => provider.id).sort()
      }

      await paytrRegionProvider({ container, args: [] })
      await paytrRegionProvider({ container, args: [] })

      expect(await providersOf(result[0]?.id ?? "")).toEqual([
        "pp_paytr_paytr",
        "pp_system_default",
      ])
      // Bootstrap gives a new shop's region every provider (iyzico since F5 V9, bank transfer F6)
      expect(await providersOf(shop.regionId)).toEqual([
        "pp_bank-transfer_bank-transfer",
        "pp_iyzico_iyzico",
        "pp_paytr_paytr",
        "pp_system_default",
      ])
    })

    it("refuses Medusa's session route for its system provider: no unpaid order", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cartId },
      })

      const viaRoute = await settle(
        http.post(
          `/store/payment-collections/${collection.id}/payment-sessions`,
          { provider_id: "pp_system_default" },
          { headers: storefront.headers }
        )
      )
      // Even a session made without the route gets no order from the storefront
      await createPaymentSessionsWorkflow(container).run({
        input: { payment_collection_id: collection.id, provider_id: "pp_system_default" },
      })
      const completed = await settle(
        http.post<{ type?: string }>(
          `/store/carts/${cartId}/complete`,
          {},
          { headers: storefront.headers }
        )
      )

      expect(viaRoute.status).toBe(400)
      expect(viaRoute.data).toMatchObject({ message: "payments.use_checkout_route" })
      expect(completed.status).toBe(400)
      expect(completed.data).toMatchObject({ message: "payments.use_checkout_route" })
    })

    it("places no order for a payment of an amount the cart no longer has", async () => {
      await connect()
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const started = await start(cartId)
      fake.pay(String(started.data.payment_session.data["merchant_oid"]))
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "cart",
        fields: ["payment_collection.id"],
        filters: { id: cartId },
      })
      // The cart's collection moves on; the session stays at what was paid
      await container
        .resolve(Modules.PAYMENT)
        .updatePaymentCollections(
          (data[0] as { payment_collection: { id: string } }).payment_collection.id,
          { amount: 300 }
        )

      const completed = await settle(
        http.post<{ type?: string }>(
          `/store/carts/${cartId}/complete`,
          {},
          { headers: storefront.headers }
        )
      )

      expect(completed.status).toBe(400)
      expect(completed.data).toMatchObject({ message: "payments.cart_changed" })
    })
  },
})

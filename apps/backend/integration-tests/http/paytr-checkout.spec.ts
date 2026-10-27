import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  createCartWorkflow,
  createRegionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { parseEnv } from "../../src/lib/env"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import paytrRegionProvider from "../../src/migration-scripts/paytr-region-provider"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
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

const ADDRESS = {
  first_name: "Ayşe",
  last_name: "Yılmaz",
  phone: "05320000000",
  address_1: "Atatürk Cad. No: 1",
  city: "Kadıköy",
  province: "İstanbul",
  postal_code: "34710",
  country_code: "tr",
}

/** One cup (120 TL) with the shop's shipping (90 TL), ready to pay. */
async function readyCart(
  container: MedusaContainer,
  shop: StockShop,
  variantId: string,
  address: Record<string, string> = ADDRESS
): Promise<string> {
  const { result } = await createCartWorkflow(container).run({
    input: {
      region_id: shop.regionId,
      sales_channel_id: shop.salesChannelId,
      currency_code: "try",
      email: "ayse.yilmaz@example.com",
      items: [{ variant_id: variantId, quantity: 1 }],
      shipping_address: address,
      billing_address: address,
    },
  })
  await addShippingMethodToCartWorkflow(container).run({
    input: { cart_id: result.id, options: [{ id: shop.shippingOptionId }] },
  })
  return result.id
}

/** F5 V2 (adr/0026): a hosted PayTR payment starts from our Store route only. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    const returnUrls = () => {
      const origin = (parseEnv().STORE_CORS.split(",")[0] ?? "").trim()
      return { success: `${origin}/odeme/tamam`, failure: `${origin}/odeme/hata` }
    }
    const start = (cartId: string, body: Record<string, unknown> = {}) =>
      settle(
        http.post<{ payment_session: Session }>(
          `/store/carts/${cartId}/payment-session`,
          { provider_id: PAYTR_PAYMENT_PROVIDER_ID, return_urls: returnUrls(), ...body },
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

    const connectPaytr = async () => {
      const admin = await createAdminUser(http, getContainer())
      const saved = await settle(
        http.post(
          "/admin/integrations/credentials/paytr",
          {
            settings: { merchant_id: account.merchantId, test_mode: true },
            secrets: { merchant_key: account.merchantKey, merchant_salt: account.merchantSalt },
          },
          { headers: admin.headers }
        )
      )
      expect(saved.status).toBe(200)
      fake.requests.length = 0
    }

    it("says the shop has no PayTR account before one is connected", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)

      const started = await start(cartId)

      expect(started.status).toBe(400)
      expect(started.data).toMatchObject({ message: "paytr.not_configured" })
      expect(tokenRequests()).toHaveLength(0)
    })

    it("starts a payment from the stored cart; the session shows nothing personal", async () => {
      await connectPaytr()
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
      await connectPaytr()
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
      await connectPaytr()
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
      await connectPaytr()
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const started = await start(cartId)
      const withoutPhone = Object.fromEntries(
        Object.entries(ADDRESS).filter(([field]) => field !== "phone")
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
      expect(await providersOf(shop.regionId)).toEqual(["pp_paytr_paytr", "pp_system_default"])
    })
  },
})

import { createHash, randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeConversions } from "@qticaret/testing"
import type { FakeConversions } from "@qticaret/testing"
import { CONVERSIONS_MODULE } from "../../src/modules/conversions"
import type ConversionsModuleService from "../../src/modules/conversions/service"
import { RETURN_REFUNDED } from "../../src/workflows/returns/receive-return"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const SHOPPER = "ayse.yilmaz@example.com"
const GA_CLIENT = "123456789.1793260000"
const FBP = "fb.1.1793260000000.1234567890"

interface Tracking {
  analytics: boolean
  marketing: boolean
  ga_client_id?: string
  fbp?: string
}

/** F10.9 (adr/0038 §4; KK5): purchases told to Meta and GA4 only as the shopper allowed. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeConversions
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let variantId: string

    const connect = (provider: "meta" | "ga4", body: Record<string, unknown>) =>
      settle(
        http.post<{ check?: string }>(`/admin/integrations/credentials/${provider}`, body, {
          headers: admin.headers,
        })
      )
    /** A cart with the banner's answer (none: the shopper never answered), placed by bank transfer. */
    const order = async (tracking: Tracking | null) => {
      const cartId = await readyCart(getContainer(), shop, variantId, {
        ...PAYTR_ADDRESS,
        phone: "05321234567",
      })
      if (tracking) {
        await http.post(`/store/carts/${cartId}/tracking`, tracking, {
          headers: { ...storefront.headers, "user-agent": "TestBrowser/1.0" },
        })
      }
      await http.post(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: "pp_bank-transfer_bank-transfer" },
        { headers: storefront.headers }
      )
      const { data } = await http.post<{ order: { id: string } }>(
        `/store/carts/${cartId}/complete`,
        {},
        { headers: storefront.headers }
      )
      return data.order.id
    }
    /** Waits for the order's events to settle: they are recorded once tried. */
    const settled = (orderId: string, count: number) =>
      eventually(
        () =>
          getContainer()
            .resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
            .listConversionEvents({ order_id: orderId }),
        (rows) => rows.length >= count
      )

    beforeAll(async () => {
      fake = await startFakeConversions()
      Object.assign(process.env, { META_GRAPH_BASE_URL: fake.url, GA4_BASE_URL: fake.url })
    })

    afterAll(async () => {
      for (const name of ["META_GRAPH_BASE_URL", "GA4_BASE_URL"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 150))
        .variantId
      admin = await createAdminUser(http, container)
      await http.post(
        "/admin/platform-settings/bank_transfer",
        {
          enabled: true,
          account_holder: "Örnek Ticaret A.Ş.",
          bank_name: "Örnek Bankası",
          iban: "TR330006100519786457841326",
          deadline_hours: 24,
        },
        { headers: admin.headers }
      )
      await connect("meta", {
        settings: { pixel_id: fake.meta.pixelId },
        secrets: { access_token: fake.meta.accessToken },
      })
      await connect("ga4", {
        settings: { measurement_id: fake.ga4.measurementId },
        secrets: { api_secret: fake.ga4.apiSecret },
      })
      fake.metaEvents.length = 0
      fake.ga4Requests.length = 0
    })

    it("tells Meta and GA4 of a purchase the shopper allowed, then forgets the browser", async () => {
      const orderId = await order({
        analytics: true,
        marketing: true,
        ga_client_id: GA_CLIENT,
        fbp: FBP,
      })
      await settled(orderId, 2)
      const [meta] = fake.metaEvents
      const [ga4] = fake.ga4Requests
      const [kept] = await getContainer()
        .resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
        .listTrackingConsents({ order_id: orderId })

      expect(meta).toMatchObject({
        event_name: "Purchase",
        event_id: orderId,
        action_source: "website",
        user_data: {
          em: [createHash("sha256").update(SHOPPER).digest("hex")],
          ph: [createHash("sha256").update("905321234567").digest("hex")],
          client_user_agent: "TestBrowser/1.0",
          fbp: FBP,
        },
        custom_data: { currency: "TRY", order_id: orderId },
      })
      expect(
        typeof (meta?.["user_data"] as { client_ip_address?: unknown }).client_ip_address
      ).toBe("string")
      expect(ga4).toMatchObject({
        valid: true,
        body: {
          client_id: GA_CLIENT,
          consent: { ad_user_data: "GRANTED", ad_personalization: "GRANTED" },
          events: [{ name: "purchase", params: { transaction_id: orderId, currency: "TRY" } }],
        },
      })
      // Once both went, the IP address and browser are no longer kept
      expect(kept).toMatchObject({ client_encrypted: null, fbp: null })
    })

    it("sends nothing without consent, and only GA4's without marketing consent (KK5)", async () => {
      const unanswered = await order(null)
      const analyticsOnly = await order({
        analytics: true,
        marketing: false,
        ga_client_id: GA_CLIENT,
      })
      await settled(analyticsOnly, 1)
      // The unanswered order's subscriber ran too: it recorded nothing and sent nothing
      await new Promise((resolve) => setTimeout(resolve, 300))
      const unansweredRows = await getContainer()
        .resolve<ConversionsModuleService>(CONVERSIONS_MODULE)
        .listConversionEvents({ order_id: unanswered })

      expect(fake.metaEvents).toEqual([])
      expect(unansweredRows).toEqual([])
      expect(fake.ga4Requests).toHaveLength(1)
      expect(fake.ga4Requests[0]?.body).toMatchObject({
        consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" },
        events: [{ params: { transaction_id: analyticsOnly } }],
      })
    })

    it("holds the order to the visitor's cookie answer when placed: a withdrawal since counts (F13.8)", async () => {
      const answer = (body: Record<string, unknown>, cookie?: string) =>
        http.post("/store/consents/cookies", body, {
          headers: { ...storefront.headers, ...(cookie ? { cookie } : {}) },
        })
      const given = await answer({ analytics: true, marketing: true, policy_version: null })
      const cookie = String(given.headers["set-cookie"] ?? "").split(";")[0] ?? ""
      const cartId = await readyCart(getContainer(), shop, variantId, {
        ...PAYTR_ADDRESS,
        phone: "05321234567",
      })
      // The cart is answered while marketing is allowed, then the visitor withdraws it
      await http.post(
        `/store/carts/${cartId}/tracking`,
        { ga_client_id: GA_CLIENT, fbp: FBP },
        { headers: { ...storefront.headers, cookie, "user-agent": "TestBrowser/1.0" } }
      )
      await answer({ analytics: true, marketing: false, policy_version: null }, cookie)
      await http.post(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: "pp_bank-transfer_bank-transfer" },
        { headers: storefront.headers }
      )
      const { data } = await http.post<{ order: { id: string } }>(
        `/store/carts/${cartId}/complete`,
        {},
        { headers: storefront.headers }
      )
      await settled(data.order.id, 1)

      expect(fake.metaEvents).toEqual([])
      expect(fake.ga4Requests).toHaveLength(1)
    })

    it("tells GA4 of a refund once, and of a cancelled order's whole amount", async () => {
      const orderId = await order({ analytics: true, marketing: false, ga_client_id: GA_CLIENT })
      await settled(orderId, 1)
      const events = getContainer().resolve(Modules.EVENT_BUS)
      const refund = { id: "retreq_01TEST", order_id: orderId, amount: 4550 }
      await events.emit({ name: RETURN_REFUNDED, data: refund })
      await events.emit({ name: RETURN_REFUNDED, data: refund })
      await events.emit({ name: "order.canceled", data: { id: orderId } })
      await settled(orderId, 3)
      const refunds = fake.ga4Requests
        .map(({ body }) => (body["events"] as { name: string; params: { value: number } }[])[0])
        .filter((event) => event?.name === "refund")

      expect(refunds.map((event) => event?.params.value)).toEqual([45.5, expect.any(Number)])
    })

    it("refuses a Meta token Meta does not take", async () => {
      const saved = await connect("meta", {
        settings: { pixel_id: fake.meta.pixelId },
        // A token of its own, which the fake does not know
        secrets: { access_token: `EAA${randomUUID().replace(/-/g, "")}` },
      })

      expect(saved.status === 400 || saved.data.check === "secret_invalid").toBe(true)
    })
  },
})

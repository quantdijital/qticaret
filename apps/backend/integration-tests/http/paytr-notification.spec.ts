import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, paytrNotification, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import webhookEventsRetention from "../../src/jobs/webhook-events-retention"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import { WEBHOOK_EVENTS_MODULE } from "../../src/modules/webhook-events"
import type WebhookEventsModuleService from "../../src/modules/webhook-events/service"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { connectPaytr, readyCart, storeReturnUrls } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()
const FORM = { headers: { "content-type": "application/x-www-form-urlencoded" } }

/** F5 V3 (adr/0026 §5): PayTR's notification places the order, once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    /** A cart with a started PayTR payment; its reference as PayTR knows it. */
    const startedPayment = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await http.post<{ payment_session: { data: Record<string, unknown> } }>(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: PAYTR_PAYMENT_PROVIDER_ID, return_urls: storeReturnUrls() },
        { headers: storefront.headers }
      )
      return { cartId, merchantOid: String(started.data.payment_session.data["merchant_oid"]) }
    }
    const notify = (fields: Record<string, string>) =>
      settle(http.post<string>("/hooks/paytr", new URLSearchParams(fields).toString(), FORM))
    const success = (merchantOid: string) =>
      paytrNotification(account, {
        merchantOid,
        status: "success",
        paymentAmount: 21000,
        testMode: true,
      })
    const orderOf = async (cartId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["completed_at", "order.id"], filters: { id: cartId } })
      return (data[0] as { order?: { id: string } | null } | undefined)?.order?.id ?? null
    }
    const events = () =>
      getContainer()
        .resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
        .listWebhookEvents({ provider: "paytr" })

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
      admin = await connectPaytr(http, container, account)
    })

    it("places the order when PayTR reports the payment; a repeat is only acknowledged", async () => {
      const { cartId, merchantOid } = await startedPayment()
      fake.pay(merchantOid)

      const first = await notify(success(merchantOid))
      const order = await orderOf(cartId)
      const repeat = await notify(success(merchantOid))

      expect(first.status).toBe(200)
      expect(first.data).toBe("OK")
      expect(order).toMatch(/^order_/)
      expect(repeat.data).toBe("OK")
      expect(await orderOf(cartId)).toBe(order)
      expect(await events()).toEqual([
        expect.objectContaining({
          event_key: `${merchantOid}:success`,
          status: "processed",
          attempts: 1,
        }),
      ])
      expect(JSON.stringify(await events())).not.toMatch(/ayse\.yilmaz|05320000000|Atatürk/)
    })

    it("opens one order when two deliveries of the notification arrive at once", async () => {
      const { cartId, merchantOid } = await startedPayment()
      fake.pay(merchantOid)

      const answers = await Promise.all([
        notify(success(merchantOid)),
        notify(success(merchantOid)),
      ])

      expect(answers.map(({ data }) => data)).toContain("OK")
      expect(await orderOf(cartId)).toMatch(/^order_/)
      expect(await events()).toHaveLength(1)
    })

    it("never answers OK to a forged notification or one for another shop's order", async () => {
      const { cartId, merchantOid } = await startedPayment()
      fake.pay(merchantOid)

      const forged = await notify({ ...success(merchantOid), hash: "Zm9yZ2Vk" })
      const foreign = await notify(success("SIP000000123"))

      expect(forged.status).toBe(400)
      expect(foreign.status).toBe(404)
      expect([forged.data, foreign.data]).not.toContain("OK")
      expect(await orderOf(cartId)).toBeNull()
      expect(await events()).toHaveLength(0)
    })

    it("leaves the cart payable after a failed payment", async () => {
      const { cartId, merchantOid } = await startedPayment()

      const failed = await notify(
        paytrNotification(account, {
          merchantOid,
          status: "failed",
          paymentAmount: 21000,
          testMode: true,
          failedReasonCode: "2",
        })
      )
      const again = await settle(
        http.post(
          `/store/carts/${cartId}/payment-session`,
          { provider_id: PAYTR_PAYMENT_PROVIDER_ID, return_urls: storeReturnUrls() },
          { headers: storefront.headers }
        )
      )

      expect(failed.data).toBe("OK")
      expect(await orderOf(cartId)).toBeNull()
      expect(again.status).toBe(200)
    })

    it("is not answered OK while PayTR's own record disagrees, and succeeds once it agrees", async () => {
      const { cartId, merchantOid } = await startedPayment()

      // The status query finds no payment yet: the order waits
      const early = await notify(success(merchantOid))
      const [failed] = await events()
      fake.pay(merchantOid)
      const later = await notify(success(merchantOid))

      expect(early.data).not.toBe("OK")
      expect(failed).toMatchObject({ status: "failed", error_code: "processing_failed" })
      expect(later.data).toBe("OK")
      expect(await orderOf(cartId)).toMatch(/^order_/)
      expect((await events())[0]).toMatchObject({ status: "processed", attempts: 2 })
    })

    it("keeps an order paid in test mode from being shipped", async () => {
      const { cartId, merchantOid } = await startedPayment()
      fake.pay(merchantOid)
      await notify(success(merchantOid))
      const orderId = (await orderOf(cartId)) ?? ""

      const ship = await settle(
        http.post(`/admin/orders/${orderId}/ship`, {}, { headers: admin.headers })
      )
      const core = await settle(
        http.post(
          `/admin/orders/${orderId}/fulfillments`,
          { items: [] },
          { headers: admin.headers }
        )
      )

      expect(ship.status).toBe(400)
      expect(ship.data).toMatchObject({ message: "orders.test_payment_not_shippable" })
      expect(core.status).toBe(400)
      expect(core.data).toMatchObject({ message: "orders.test_payment_not_shippable" })
    })

    it("forgets notification records after 90 days", async () => {
      const service = getContainer().resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
      // created_at is set by the database; an old record is backdated for the test
      await service.createWebhookEvents([
        {
          provider: "paytr",
          event_key: "old:success",
          created_at: new Date(Date.now() - 100 * 86_400_000),
        },
        { provider: "paytr", event_key: "new:success" },
      ] as Parameters<typeof service.createWebhookEvents>[0])

      await webhookEventsRetention(getContainer())

      expect((await events()).map(({ event_key }) => event_key)).toEqual(["new:success"])
    })
  },
})

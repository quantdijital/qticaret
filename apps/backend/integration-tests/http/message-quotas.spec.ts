import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail, startFakeNetgsm } from "@qticaret/testing"
import type { FakeMail, FakeNetgsm } from "@qticaret/testing"
import { sharedRateLimitStore } from "../../src/api/http/rate-limit"
import { SMS_LIMITS } from "../../src/lib/messaging/sms/quota"
import { ipBucket, perIpScale } from "../../src/lib/security/rate-limit"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { sendMessageWorkflow } from "../../src/workflows/messaging/send-message"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { PAYTR_ADDRESS, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const SHOPPER = "ayse.yilmaz@example.com"
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// Counters live in Redis across runs: each run texts numbers of its own
const randomPhone = () => `053${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`

/** Hits a counter until it is at least `count`; returns where it stands. */
async function fillTo(key: string, windowMs: number, count: number): Promise<number> {
  let now = 0
  while (now < count) {
    now = (await sharedRateLimitStore().hit(key, windowMs)).count
  }
  return now
}

/** F10 M9: a checkout's texts held for a flooding address; the shop's e-mails a day. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let netgsm: FakeNetgsm
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let variantId: string

    const settings = (body: Record<string, unknown>) =>
      http.post("/admin/platform-settings/notifications", body, { headers: admin.headers })
    const resend = async (orderId: string, key: string) =>
      (
        await sendMessageWorkflow(getContainer()).run({
          input: { template: "order.placed", resource_id: orderId, key },
        })
      ).result as { email?: string; sms?: string }

    beforeAll(async () => {
      fake = await startFakeMail()
      netgsm = await startFakeNetgsm()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
        NETGSM_BASE_URL: netgsm.url,
      })
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM", "NETGSM_BASE_URL"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await Promise.all([fake.close(), netgsm.close()])
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120))
        .variantId
      admin = await createAdminUser(http, container)
      // The shop's day counts every run's messages: far above them unless a test says otherwise
      await settings({ sms_daily_limit: 100_000, email_daily_limit: 200_000 })
      fake.messages.length = 0
      netgsm.messages.length = 0
    })

    it("holds the texts of carts completed past an address's hourly limit, and still e-mails", async () => {
      await http.post(
        "/admin/integrations/credentials/netgsm",
        {
          settings: { msgheader: "MAGAZA" },
          secrets: { usercode: netgsm.account.usercode, password: netgsm.account.password },
        },
        { headers: admin.headers }
      )
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
      // This address has completed its hour's carts already (the test client's, either
      // family); for the hour, no other test's checkout over HTTP texts either
      const limit = SMS_LIMITS.perIpHour * perIpScale()
      for (const address of ["127.0.0.1", "::1"]) {
        await fillTo(`sms:checkout:${ipBucket(address) ?? ""}`, HOUR, limit)
      }
      const phone = randomPhone()
      const cartId = await readyCart(getContainer(), shop, variantId, { ...PAYTR_ADDRESS, phone })
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
      await eventually(
        () => Promise.resolve(fake.messages.filter(({ to }) => to.includes(SHOPPER))),
        (found) => found.length > 0
      )
      const again = await resend(data.order.id, "tekrar")
      const cart = await getContainer()
        .resolve(Modules.CART)
        .retrieveCart(cartId, { select: ["metadata"] })

      expect(cart.metadata).toMatchObject({ qt_sms_held: true })
      expect(again).toEqual({ email: "sent", sms: "over_quota" })
      expect(netgsm.messages.filter(({ to }) => to === `9${phone}`)).toEqual([])
    })

    it("stops e-mail past the shop's day, telling staff in the bell at 80%", async () => {
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email: SHOPPER,
      })
      await eventually(
        () => Promise.resolve(fake.messages.filter(({ to }) => to.includes(SHOPPER))),
        (found) => found.length > 0
      )
      // Today's count from every run so far; the next e-mail is the one at 80%
      const day = new Date().toISOString().slice(0, 10)
      const sent = await fillTo(`email:shop:${day}`, DAY, 99)
      const limit = Math.floor(1.25 * (sent + 1))
      await settings({ email_daily_limit: limit })
      const warned = await resend(orderId, "kota-1")
      await settings({ email_daily_limit: 100 })
      const refused = await resend(orderId, "kota-2")
      const bell = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ trigger_type: "messaging.email_daily_limit" })

      expect(warned.email).toBe("sent")
      expect(refused.email).toBe("over_quota")
      expect(bell).toHaveLength(1)
      expect(bell[0]?.data).toMatchObject({ kind: "email_daily_limit", count: sent + 1, limit })
    })
  },
})

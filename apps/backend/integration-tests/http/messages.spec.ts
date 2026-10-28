import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail, startFakeNetgsm } from "@qticaret/testing"
import type { FakeMail, FakeNetgsm } from "@qticaret/testing"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import { RETURN_REQUESTS_MODULE } from "../../src/modules/return-requests"
import type ReturnRequestsModuleService from "../../src/modules/return-requests/service"
import { RETURN_REQUEST_APPROVED, RETURN_REQUEST_CREATED } from "../../src/workflows/returns/events"
import { RETURN_REFUNDED } from "../../src/workflows/returns/receive-return"
import { PAYMENT_FAILED } from "../../src/workflows/payments/events"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { sendMessageWorkflow } from "../../src/workflows/messaging/send-message"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const SHOPPER = "ayse.yilmaz@example.com"

/** F9 N1 (adr/0036): one path out for every message, once per event, never to a suppressed address. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let fake: FakeMail
    let netgsm: FakeNetgsm
    let shop: StockShop
    let variantId: string

    const order = (email: string | null = SHOPPER) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 2 }],
        address: PAYTR_ADDRESS,
        email: email ?? undefined,
      })
    const sentTo = (address: string) => fake.messages.filter(({ to }) => to.includes(address))
    const resend = (orderId: string) =>
      sendMessageWorkflow(getContainer()).run({
        input: { template: "order.placed", resource_id: orderId },
      })

    beforeAll(async () => {
      fake = await startFakeMail()
      netgsm = await startFakeNetgsm()
      process.env["NETGSM_BASE_URL"] = netgsm.url
      process.env["EMAIL_TRANSPORT"] = "mailpit"
      process.env["MAILPIT_URL"] = fake.url
      process.env["EMAIL_FROM"] = "bildirim@platform.example"
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
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120))
        .variantId
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("store", { contact_email: "destek@magaza.example" }, null)
      admin = await createAdminUser(http, container)
      fake.messages.length = 0
      netgsm.messages.length = 0
    })

    it("tells the shopper the order was placed, once, from the shop, and stores no message", async () => {
      const orderId = await order()

      const [mail] = await eventually(
        () => Promise.resolve(sentTo(SHOPPER)),
        (found) => found.length > 0
      )
      const again = await resend(orderId)
      const rows = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ resource_id: orderId, channel: "email" })

      expect(mail).toMatchObject({
        template: "order.placed",
        replyTo: ["destek@magaza.example"],
      })
      expect(mail?.from).toBe("bildirim@platform.example")
      expect(mail?.subject).toMatch(/^Siparişiniz alındı \(#\d+\)$/)
      expect(mail?.html).toContain("Ayşe")
      expect(mail?.text).toContain("× ")
      // The same event again sends nothing
      expect(again.result).toMatchObject({ email: "duplicate" })
      expect(sentTo(SHOPPER)).toHaveLength(1)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ status: "success", template: "order.placed" })
      expect(JSON.stringify(rows[0]?.data)).not.toContain("Ayşe")
    })

    it("sends nothing to a suppressed address, and nothing for an order without one", async () => {
      await getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE).suppress({
        channel: "email",
        address: "GERI@example.com",
        reason: "bounce",
        source: "resend",
      })

      const bounced = await order("geri@example.com")
      const silent = await order(null)
      const outcomes = [await resend(bounced), await resend(silent)].map(({ result }) => result)

      expect(outcomes[0]).toMatchObject({ email: "suppressed" })
      expect(outcomes[1]).not.toHaveProperty("email")
      expect(fake.messages).toHaveLength(0)
    })

    it("tells the shopper the parcel left and arrived, unless the shop ships it without notice", async () => {
      const ship = (orderId: string, notify: boolean) =>
        settle(
          http.post<{ fulfillment_id: string }>(
            `/admin/orders/${orderId}/ship`,
            { notify },
            { headers: admin.headers }
          )
        )
      const told = await order()
      const quiet = await order("sessiz@example.com")
      await eventually(
        () => Promise.resolve(fake.messages.filter(({ template }) => template === "order.placed")),
        (found) => found.length === 2
      )

      const shipped = await ship(told, true)
      await ship(quiet, false)
      const delivered = await settle(
        http.post(
          `/admin/orders/${told}/fulfillments/${shipped.data.fulfillment_id}/mark-as-delivered`,
          {},
          { headers: admin.headers }
        )
      )
      const mails = await eventually(
        () => Promise.resolve(sentTo(SHOPPER).map(({ template }) => template)),
        (templates) => templates.includes("order.delivered")
      )

      expect(delivered.status).toBe(200)
      expect(mails.sort()).toEqual(["order.delivered", "order.placed", "order.shipped"])
      expect(sentTo("sessiz@example.com").map(({ template }) => template)).toEqual(["order.placed"])
      const [shippedMail] = sentTo(SHOPPER).filter(({ template }) => template === "order.shipped")
      expect(shippedMail?.subject).toMatch(/^Siparişiniz kargoya verildi \(#\d+\)$/)
      expect(shippedMail?.text).toMatch(/2 × kupa-/)
    })

    it("tells the shopper an exchange request arrived, was approved with its code, and was refunded", async () => {
      const orderId = await order()
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
      const lineId = (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
      const requests = getContainer().resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
      const request = await requests.createReturnRequests({
        order_id: orderId,
        customer_id: null,
        kind: "exchange",
        reason: "size_issue",
        note: null,
        items: [{ line_item_id: lineId, quantity: 1 }] as unknown as Record<string, unknown>,
      })
      const events = getContainer().resolve(Modules.EVENT_BUS)
      const emit = (name: string) =>
        events.emit({ name, data: { id: request.id, order_id: orderId, kind: "exchange" } })

      await emit(RETURN_REQUEST_CREATED)
      await requests.updateReturnRequests({
        id: request.id,
        status: "approved",
        return_code: "GLV0042",
      })
      await emit(RETURN_REQUEST_APPROVED)
      await requests.updateReturnRequests({
        id: request.id,
        status: "refunded",
        refund_amount: 4_250,
      })
      await emit(RETURN_REFUNDED)
      const mails = await eventually(
        () =>
          Promise.resolve(sentTo(SHOPPER).filter(({ template }) => template.startsWith("return."))),
        (found) => found.length === 3
      )
      const by = (template: string) => mails.find((mail) => mail.template === template)

      expect(by("return.requested")?.subject).toMatch(/^Değişim talebiniz alındı \(#\d+\)$/)
      expect(by("return.approved")?.text).toContain("bu kodu söyleyin: GLV0042")
      expect(by("return.refunded")?.text).toContain("İade tutarı: ₺42,50")
    })

    it("sends a customer's reset link to the storefront's page, and nothing without a domain", async () => {
      const customer = await registerCustomer(http, await createStorefront(getContainer()))
      const reset = () =>
        settle(http.post("/auth/customer/emailpass/reset-password", { identifier: customer.email }))

      await reset()
      await new Promise((resolve) => setTimeout(resolve, 500))
      const withoutDomain = sentTo(customer.email).length
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      await reset()
      const [mail] = await eventually(
        () => Promise.resolve(sentTo(customer.email)),
        (found) => found.length > 0
      )

      expect(withoutDomain).toBe(0)
      expect(mail?.template).toBe("account.password_reset")
      expect(mail?.html).toMatch(
        /href="https:\/\/magaza\.example\.com\/hesap\/sifre-yenile\?token=[^"&]+&amp;email=/
      )
      const rows = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ template: "account.password_reset" })
      // The token names no stored row and sits in no stored data
      expect(JSON.stringify(rows)).not.toMatch(/token=|eyJ/)
    })

    it("sends the code that confirms an e-mail address, and stores no code", async () => {
      const code = String(100_000 + Math.floor(Math.random() * 900_000))
      await getContainer()
        .resolve(Modules.EVENT_BUS)
        .emit({
          name: "auth.verification_requested",
          data: {
            entity_id: "dogrula@example.com",
            entity_type: "email",
            code_provider: "emailpass",
            auth_identity_id: "authid_test",
            code,
            expires_at: new Date(Date.now() + 15 * 60 * 1000),
          },
        })
      const [mail] = await eventually(
        () => Promise.resolve(sentTo("dogrula@example.com")),
        (found) => found.length > 0
      )
      const rows = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ template: "account.verify_email" })

      expect(mail?.text).toContain(code)
      expect(mail?.subject).toBe("E-posta adresinizi doğrulayın")
      expect(JSON.stringify(rows)).not.toContain(code)
    })

    it("tells the shopper a payment was refused once a day, and not once the cart is paid", async () => {
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
          email: "reddedildi@example.com",
          items: [{ variant_id: variantId, quantity: 1 }],
          shipping_address: { ...PAYTR_ADDRESS, country_code: "tr" },
        },
      })
      const paidId = await order("odendi@example.com")
      const { data: paid } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["cart.id"], filters: { id: paidId } })
      const events = getContainer().resolve(Modules.EVENT_BUS)
      const fail = (cartId: string) =>
        events.emit({ name: PAYMENT_FAILED, data: { cart_id: cartId, provider: "paytr" } })

      await fail(cart.id)
      await fail(cart.id)
      await fail((paid[0] as { cart: { id: string } }).cart.id)
      const [mail] = await eventually(
        () => Promise.resolve(sentTo("reddedildi@example.com")),
        (found) => found.length > 0
      )
      await new Promise((resolve) => setTimeout(resolve, 500))

      expect(mail?.subject).toBe("Ödemeniz tamamlanamadı")
      expect(sentTo("reddedildi@example.com")).toHaveLength(1)
      expect(
        sentTo("odendi@example.com").filter(({ template }) => template === "payment.failed")
      ).toHaveLength(0)
    })

    it("texts the shopper too once the shop connects its Netgsm account, and checks its sender name", async () => {
      const connect = (msgheader: string) =>
        settle(
          http.post<{ message?: string }>(
            "/admin/integrations/credentials/netgsm",
            {
              settings: { msgheader },
              secrets: { usercode: netgsm.account.usercode, password: netgsm.account.password },
            },
            { headers: admin.headers }
          )
        )
      const before = await order()
      const wrongHeader = await connect("BASKA")
      await connect("MAGAZA")
      const after = await order()
      const [sms] = await eventually(
        () => Promise.resolve(netgsm.messages),
        (found) => found.length > 0
      )
      const outcome = await resend(before)

      expect(wrongHeader.data.message).toBe("netgsm.merchant_invalid")
      expect(sms).toMatchObject({ to: "905320000000", header: "MAGAZA", filter: "0" })
      expect(sms?.text).toMatch(/: #\d+ numaralı siparişiniz alındı\. Toplam ₺/)
      expect(after).not.toBe(before)
      // The first order went before the account: its SMS goes now, its e-mail went already
      expect(netgsm.messages).toHaveLength(2)
      expect(outcome.result).toMatchObject({ email: "duplicate", sms: "sent" })
    })

    it("tries a failed send again with the same key, and sends it once", async () => {
      fake.failNext(500)
      const orderId = await order()
      await eventually(
        () =>
          getContainer()
            .resolve(Modules.NOTIFICATION)
            .listNotifications({ resource_id: orderId, channel: "email" }),
        (rows) => rows[0]?.status === "failure"
      )

      const retried = await resend(orderId)
      const rows = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ resource_id: orderId, channel: "email" })

      expect(retried.result).toMatchObject({ email: "sent" })
      expect(sentTo(SHOPPER)).toHaveLength(1)
      expect(rows.map(({ status }) => status)).toEqual(["success"])
    })
  },
})

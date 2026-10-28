import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { sendOrderMessageWorkflow } from "../../src/workflows/messaging/send-order-message"
import { eventually } from "../helpers/eventually"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const SHOPPER = "ayse.yilmaz@example.com"

/** F9 N1 (adr/0036): one path out for every message, once per event, never to a suppressed address. */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    let fake: FakeMail
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
      sendOrderMessageWorkflow(getContainer()).run({
        input: { order_id: orderId, template: "order.placed" },
      })

    beforeAll(async () => {
      fake = await startFakeMail()
      process.env["EMAIL_TRANSPORT"] = "mailpit"
      process.env["MAILPIT_URL"] = fake.url
      process.env["EMAIL_FROM"] = "bildirim@platform.example"
    })

    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
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
      fake.messages.length = 0
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

import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface Message {
  id: string
  template: string
  channel: string
  state: string
  to: string | null
  resendable: boolean
}

interface Who {
  headers: Record<string, string>
}

/** 2026-11-06: "Mesajı yeniden gönder" on an order, from its template, to its current address. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let shop: StockShop
    let variantId: string

    const order = (email: string) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email,
      })
    const messagesOf = async (orderId: string, who: Who) =>
      (await http.get<{ messages: Message[] }>(`/admin/orders/${orderId}/messages`, who)).data
        .messages
    const resend = (orderId: string, messageId: string, who: Who) =>
      settle(
        http.post<{ channel?: string; outcome?: string; message?: string }>(
          `/admin/orders/${orderId}/messages/${messageId}/resend`,
          {},
          { headers: who.headers }
        )
      )
    /** The sends of the message as if ten minutes had passed. */
    const age = (orderId: string) =>
      getContainer()
        .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
        .raw(
          "update notification set created_at = now() - interval '11 minutes' where resource_id = ?",
          [orderId]
        )

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
      variantId = (await stockedProduct(container, shop, `yeniden-${String(Date.now())}`, 10, 90))
        .variantId
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("store", { contact_email: "destek@magaza.example" }, null)
      fake.messages.length = 0
    })

    it("sends the confirmation again to the order's current address, once in ten minutes", async () => {
      const owner = await createAdminUser(http, getContainer())
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const orderId = await order("ilk@example.com")
      const other = await order("baska@example.com")
      const [placed] = await eventually(
        () => messagesOf(orderId, owner),
        (rows) => rows.length > 0
      )
      const [otherPlaced] = await eventually(
        () => messagesOf(other, owner),
        (rows) => rows.length > 0
      )
      const messageId = placed?.id ?? ""

      expect(placed).toMatchObject({ template: "order.placed", state: "sent", resendable: true })
      const tooSoon = await resend(orderId, messageId, owner)
      expect(tooSoon.status).toBe(409)
      expect(tooSoon.data.message).toBe("messages.sent_recently")

      // The customer corrected their address on the order: the message goes there
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders([{ id: orderId, email: "duzeltilmis@example.com" }])
      await age(orderId)
      expect((await resend(orderId, messageId, readonly)).status).toBe(403)
      expect((await resend(orderId, otherPlaced?.id ?? "", owner)).status).toBe(404)
      expect((await resend(orderId, "noti_yok", owner)).status).toBe(404)
      const sent = await resend(orderId, messageId, operations)

      expect(sent.status).toBe(200)
      expect(sent.data).toEqual({ channel: "email", outcome: "sent" })
      expect(fake.messages.filter(({ to }) => to.includes("duzeltilmis@example.com"))).toHaveLength(
        1
      )
      const history = await messagesOf(orderId, owner)
      expect(history.map((row) => [row.template, row.state, row.to])).toEqual([
        ["order.placed", "sent", "du***@example.com"],
        ["order.placed", "sent", "il***@example.com"],
      ])
      expect((await resend(orderId, history[0]?.id ?? "", owner)).status).toBe(409)
    })
  },
})

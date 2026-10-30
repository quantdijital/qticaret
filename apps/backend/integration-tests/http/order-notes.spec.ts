import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { MESSAGE_TEMPLATES } from "../../src/lib/messaging/templates"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { ORDER_NOTES_MODULE } from "../../src/modules/order-notes"
import type OrderNotesModuleService from "../../src/modules/order-notes/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { deliver } from "../../src/workflows/messaging/deliver"
import { sendMessageWorkflow } from "../../src/workflows/messaging/send-message"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface Note {
  id: string
  body: string
  author: { id: string; name: string } | null
  deletable: boolean
}

interface Message {
  template: string
  channel: string
  state: string
  reason: string | null
  to: string | null
}

/** F12.8: the team's notes on an order, and what its customer was sent or not. */
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
      variantId = (await stockedProduct(container, shop, `not-${String(Date.now())}`, 10, 90))
        .variantId
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("store", { contact_email: "destek@magaza.example" }, null)
      fake.messages.length = 0
    })

    it("keeps the team's notes; the author or the owner removes one, read-only staff write none", async () => {
      const owner = await createAdminUser(http, getContainer())
      const operations = await createAdminUser(http, getContainer(), "operations")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      await getContainer()
        .resolve(Modules.USER)
        .updateUsers({ id: operations.userId, first_name: "Elif", last_name: "Kaya" })
      const orderId = await order("not@example.com")
      const notes = `/admin/orders/${orderId}/notes`
      const write = (who: { headers: Record<string, string> }, body: unknown) =>
        settle(http.post<{ note: { id: string } }>(notes, body, { headers: who.headers }))
      const list = async (who: { headers: Record<string, string> }) =>
        (await http.get<{ notes: Note[] }>(notes, { headers: who.headers })).data.notes

      const ownerNote = await write(owner, { body: "  Müşteri aradı, kapıda bırakılsın.  " })
      const opsNote = await write(operations, { body: "Paket iki kat sarıldı." })
      expect(ownerNote.status).toBe(201)
      expect(opsNote.status).toBe(201)
      expect((await write(readonly, { body: "Deneme" })).status).toBe(403)
      expect((await write(operations, { body: "   " })).status).toBe(400)
      expect((await write(operations, { body: "x".repeat(2001) })).status).toBe(400)
      expect((await write(operations, { body: "Not", extra: true })).status).toBe(400)
      expect(
        (await settle(http.post(`/admin/orders/order_yok/notes`, { body: "Not" }, owner))).status
      ).toBe(404)

      // Oldest first, trimmed, named; each reader may remove what is theirs
      const seen = await list(operations)
      expect(seen.map((note) => note.body)).toEqual([
        "Müşteri aradı, kapıda bırakılsın.",
        "Paket iki kat sarıldı.",
      ])
      expect(seen[1]?.author).toEqual({ id: operations.userId, name: "Elif Kaya" })
      expect(seen.map((note) => note.deletable)).toEqual([false, true])
      expect((await list(owner)).map((note) => note.deletable)).toEqual([true, true])
      expect((await list(readonly)).map((note) => note.deletable)).toEqual([false, false])

      const remove = (who: { headers: Record<string, string> }, id: string) =>
        settle(http.delete(`${notes}/${id}`, { headers: who.headers }))
      expect((await remove(operations, ownerNote.data.note.id)).status).toBe(403)
      expect((await remove(readonly, opsNote.data.note.id)).status).toBe(403)
      expect((await remove(owner, opsNote.data.note.id)).status).toBe(200)
      expect((await remove(owner, opsNote.data.note.id)).status).toBe(404)
      expect((await list(owner)).map((note) => note.body)).toEqual([
        "Müşteri aradı, kapıda bırakılsın.",
      ])
      // Its text may name the customer: it goes, who removed it stays
      const [removed] = await getContainer()
        .resolve<OrderNotesModuleService>(ORDER_NOTES_MODULE)
        .listOrderNotes({ id: opsNote.data.note.id }, { withDeleted: true })
      expect(removed).toMatchObject({ body: "", removed_by: owner.userId })
    })

    it("shows what the customer was sent and what was not, and why", async () => {
      const owner = await createAdminUser(http, getContainer())
      await getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE).suppress({
        channel: "email",
        address: "geri@example.com",
        reason: "bounce",
        source: "resend",
      })
      const told = await order("ayse.yilmaz@example.com")
      const bounced = await order("geri@example.com")
      const messagesOf = async (path: string) =>
        (await http.get<{ messages: Message[]; limited: boolean }>(path, owner)).data.messages

      const sent = await eventually(
        () => messagesOf(`/admin/orders/${told}/messages`),
        (rows) => rows.length > 0
      )
      expect(sent).toEqual([
        expect.objectContaining({
          template: "order.placed",
          channel: "email",
          state: "sent",
          reason: null,
          to: "ay***@example.com",
        }),
      ])
      // The team's own alert about the order is not the customer's history
      expect(sent.some((row) => row.template.startsWith("staff."))).toBe(false)

      const skipped = await eventually(
        () => messagesOf(`/admin/orders/${bounced}/messages`),
        (rows) => rows.length > 0
      )
      expect(skipped).toEqual([
        expect.objectContaining({
          template: "order.placed",
          state: "skipped",
          reason: "suppressed",
          to: "ge***@example.com",
        }),
      ])

      // Sent once: a later hold on the address makes it no message not sent
      await getContainer().resolve<MessagingModuleService>(MESSAGING_MODULE).suppress({
        channel: "email",
        address: "ayse.yilmaz@example.com",
        reason: "complaint",
        source: "resend",
      })
      const again = await sendMessageWorkflow(getContainer()).run({
        input: { template: "order.placed", resource_id: told },
      })
      expect(again.result).toMatchObject({ email: "duplicate" })
      // The team's alerts, sent or not, are not the customer's history
      await deliver(getContainer(), {
        template: "staff.new_order",
        resource: { type: "order", id: bounced },
        recipients: { email: "geri@example.com" },
        receiverId: null,
        vars: MESSAGE_TEMPLATES["staff.new_order"].sample,
      })
      expect(
        (
          await getContainer()
            .resolve<MessagingModuleService>(MESSAGING_MODULE)
            .listMessageSkips({ resource_id: bounced })
        ).map((row) => row.template)
      ).toEqual(["order.placed"])
      expect(await messagesOf(`/admin/orders/${told}/messages`)).toHaveLength(1)

      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["customer_id"], filters: { id: told } })
      const customerId = (data[0] as { customer_id: string }).customer_id
      const history = await messagesOf(`/admin/customers/${customerId}/messages`)
      expect(history.map((row) => [row.template, row.state])).toEqual([["order.placed", "sent"]])
      expect((await settle(http.get(`/admin/customers/cus_yok/messages`, owner))).status).toBe(404)
    })
  },
})

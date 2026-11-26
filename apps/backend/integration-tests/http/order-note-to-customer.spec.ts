import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
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
  sent_to_customer: string | null
}

interface Message {
  template: string
  state: string
}

/** Batch 9 / O3: a note staff choose to send reaches the order's customer, escaped, once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let shop: StockShop
    let variantId: string

    const order = (email?: string) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        ...(email ? { email } : {}),
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

    it("e-mails the note escaped, marks it sent, and keeps it in the order's history", async () => {
      const owner = await createAdminUser(http, getContainer())
      const orderId = await order("ayse.yilmaz@example.com")
      const notes = `/admin/orders/${orderId}/notes`
      const write = (body: unknown) =>
        settle(
          http.post<{ note: { id: string }; sent: string | null }>(notes, body, {
            headers: owner.headers,
          })
        )

      const inside = await write({ body: "Yalnız ekip için." })
      const told = await write({
        body: 'Kılıf yarın geliyor.\n<script>alert("x")</script> <a href="https://kotu.example">tıkla</a>',
        notify_customer: true,
      })
      expect(inside.status).toBe(201)
      expect(inside.data.sent).toBeNull()
      expect(told.status).toBe(201)
      expect(told.data.sent).toBe("sent")

      const mail = await eventually(
        () => Promise.resolve(fake.messages.filter((each) => each.template === "order.note")),
        (rows) => rows.length > 0
      )
      expect(mail).toHaveLength(1)
      expect(mail[0]?.to).toEqual(["ayse.yilmaz@example.com"])
      expect(mail[0]?.html).toContain("Kılıf yarın geliyor.<br>")
      expect(mail[0]?.html).not.toContain("<script>")
      expect(mail[0]?.html).toContain("&lt;script&gt;")
      expect(mail[0]?.html).not.toContain('href="https://kotu.example"')
      // The team-only note never went out
      expect(fake.messages.some((each) => each.html.includes("Yalnız ekip için."))).toBe(false)

      const listed = (await http.get<{ notes: Note[] }>(notes, { headers: owner.headers })).data
        .notes
      expect(listed.map((note) => note.sent_to_customer)).toEqual([null, "sent"])
      const history = (
        await http.get<{ messages: Message[] }>(`/admin/orders/${orderId}/messages`, {
          headers: owner.headers,
        })
      ).data.messages
      expect(history.some((row) => row.template === "order.note" && row.state === "sent")).toBe(
        true
      )
    })

    it("keeps the note but sends nothing when the shop turned the message off or the order has no address", async () => {
      const owner = await createAdminUser(http, getContainer())
      const off = await settle(
        http.post(
          "/admin/messaging/customer-messages/order.note",
          { enabled: false },
          { headers: owner.headers }
        )
      )
      expect(off.status).toBe(200)
      const orderId = await order("ayse.yilmaz@example.com")
      const turnedOff = await settle(
        http.post<{ sent: string | null }>(
          `/admin/orders/${orderId}/notes`,
          { body: "Kapalıyken.", notify_customer: true },
          { headers: owner.headers }
        )
      )
      expect(turnedOff.status).toBe(201)
      expect(turnedOff.data.sent).toBe("template_off")

      await settle(
        http.post(
          "/admin/messaging/customer-messages/order.note",
          { enabled: true },
          { headers: owner.headers }
        )
      )
      const noAddress = await order()
      const nowhere = await settle(
        http.post<{ sent: string | null }>(
          `/admin/orders/${noAddress}/notes`,
          { body: "Adres yok.", notify_customer: true },
          { headers: owner.headers }
        )
      )
      expect(nowhere.status).toBe(201)
      expect(nowhere.data.sent).toBe("not_sent")
      expect(fake.messages.some((each) => each.template === "order.note")).toBe(false)
    })

    it("refuses a non-boolean flag and read-only staff", async () => {
      const owner = await createAdminUser(http, getContainer())
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const orderId = await order("ayse.yilmaz@example.com")
      const post = (body: unknown, headers: Record<string, string>) =>
        settle(http.post(`/admin/orders/${orderId}/notes`, body, { headers }))

      expect((await post({ body: "x", notify_customer: "yes" }, owner.headers)).status).toBe(400)
      expect((await post({ body: "x", notify_customer: true }, readonly.headers)).status).toBe(403)
      expect(fake.messages.some((each) => each.template === "order.note")).toBe(false)
    })
  },
})

import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CONTACT_MESSAGES_MODULE } from "../../src/modules/contact-messages"
import type ContactMessagesModuleService from "../../src/modules/contact-messages/service"
import { contactMessagesFor, eraseContactMessages } from "../../src/workflows/contact/customer-data"
import { createAdminUser } from "../helpers/admin"
import { emptyCart, publishTour } from "../helpers/booking-tour"
import type { Tour } from "../helpers/booking-tour"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { loadTrAddressFixture } from "../helpers/tr-address"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Answer = { status?: string; message?: string } & Record<string, unknown>

interface Listed {
  id: string
  subject: string
  name: string
  email: string
  phone: string | null
  body: string
  product_id: string | null
  product_title: string | null
  details: Record<string, unknown> | null
}

const DAY = 24 * 60 * 60 * 1000
// A phone of each test's own: a phone is counted five an hour across the file (D1)
let dialled = 10

/** adr/0076 Ek 2026-11-23: a dated product's call-me request, kept as a sealed contact message. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let tour: Tour
    let phone: string

    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const ask = (body: Record<string, unknown>) =>
      settle(http.post<Answer>("/store/booking-requests", body, { headers: store.headers }))
    const request = (extra: Record<string, unknown> = {}) => ({
      product_id: tour.productId,
      name: "Ayşe Yılmaz",
      phone,
      adults: 2,
      consent: true,
      ...extra,
    })
    // A departure moved or cancelled under the request, as no route would
    const slotRow = () =>
      getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)("booking_slot")
    const listFor = async (query: string) =>
      (
        await settle(
          http.get<{ contact_messages: Listed[] }>(`/admin/contact-messages?${query}`, {
            headers: admin.headers,
          })
        )
      ).data.contact_messages

    beforeEach(async () => {
      phone = `0532 123 45 ${String((dialled += 1))}`
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      tour = await publishTour(http, admin.headers, shop, "none")
      await staff(`/admin/products/${tour.productId}/bookable`, {
        sale_mode: "request",
        max_units_per_cart: 6,
      })
    })
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("keeps a request sealed, its product and dates in the open, and rings the shop", async () => {
      const sent = await ask(
        request({ slot_id: tour.slotId, children: 1, email: "ayse@example.com", note: "Arayın" })
      )
      expect([sent.status, sent.data.status]).toEqual([202, "received"])

      const listed = await settle(
        http.get<{ contact_messages: Listed[] }>("/admin/contact-messages?subject=booking", {
          headers: admin.headers,
        })
      )
      const mine = listed.data.contact_messages.find((row) => row.product_id === tour.productId)
      expect(mine).toMatchObject({
        subject: "booking",
        name: "Ayşe Yılmaz",
        phone: `+90532123${phone.slice(-5).replace(" ", "")}`,
        email: "ayse@example.com",
        body: "Arayın",
        details: { slot_id: tour.slotId, adults: 2, children: 1 },
      })
      expect(mine?.product_title).toMatch(/^Efes turu/)

      const [row] = await getContainer()
        .resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
        .listContactMessages({ id: mine?.id ?? "" }, { take: 1 })
      expect(row?.sealed).not.toContain("Ayşe")
      expect(row?.sealed).not.toContain(phone.replace(/\D/g, "").slice(-10))
      expect(row?.details).toEqual({ slot_id: tour.slotId, adults: 2, children: 1 })

      const bell = await eventually(
        () =>
          getContainer()
            .resolve(Modules.NOTIFICATION)
            .listNotifications({ channel: "feed", resource_id: mine?.id ?? "" }),
        (rows) => rows.length > 0
      )
      expect(bell[0]?.data).toMatchObject({
        kind: "contact_message",
        subject: "booking",
        product_id: tour.productId,
      })
      expect(String(bell[0]?.data?.["description"])).toContain("2 yetişkin, 1 çocuk")
      expect(JSON.stringify(bell[0]?.data)).not.toContain("Ayşe")
    })

    it("takes open dates, a day or a month, with a phone only", async () => {
      const month = new Date(Date.now() + 40 * DAY).toISOString().slice(0, 7)
      expect((await ask(request())).status).toBe(202)
      expect((await ask(request({ month }))).status).toBe(202)
      const listed = await settle(
        http.get<{ contact_messages: Listed[] }>("/admin/contact-messages?subject=booking", {
          headers: admin.headers,
        })
      )
      const details = listed.data.contact_messages.map((row) => row.details)
      expect(details).toEqual(expect.arrayContaining([{ adults: 2 }, { month, adults: 2 }]))
      expect(listed.data.contact_messages.every((row) => row.email === "")).toBe(true)
    })

    it("answers as if it did not exist while dated products are off", async () => {
      await flag("catalog.booking", false)
      expect((await ask(request())).status).toBe(404)
    })

    it("refuses a product sold online only, and the cart of one sold by request only", async () => {
      await staff(`/admin/products/${tour.productId}/bookable`, { sale_mode: "online" })
      const refused = await ask(request())
      expect([refused.status, refused.data.message]).toEqual([400, "booking.request_not_offered"])

      await staff(`/admin/products/${tour.productId}/bookable`, { sale_mode: "request" })
      const cartId = await emptyCart(getContainer(), shop)
      const held = await settle(
        http.post<Answer>(
          `/store/carts/${cartId}/bookings`,
          { slot_id: tour.slotId, items: [{ variant_id: tour.adult, quantity: 1 }] },
          { headers: store.headers }
        )
      )
      expect([held.status, held.data.message]).toEqual([400, "booking.online_not_offered"])
    })

    it("refuses another product's departure, a past one and a cancelled one", async () => {
      const other = await publishTour(http, admin.headers, shop, "none")
      await staff(`/admin/products/${other.productId}/bookable`, { sale_mode: "both" })
      const foreign = await ask(request({ slot_id: other.slotId }))
      expect([foreign.status, foreign.data.message]).toEqual([400, "booking.request_slot_invalid"])

      await slotRow()
        .where({ id: tour.slotId })
        .update({ starts_at: new Date(Date.now() - DAY) })
      const late = await ask(request({ slot_id: tour.slotId }))
      expect([late.status, late.data.message]).toEqual([400, "booking.request_slot_invalid"])

      await slotRow()
        .where({ id: tour.slotId })
        .update({ starts_at: new Date(Date.now() + 5 * DAY), status: "cancelled" })
      const cancelled = await ask(request({ slot_id: tour.slotId }))
      expect([cancelled.status, cancelled.data.message]).toEqual([
        400,
        "booking.request_slot_invalid",
      ])
    })

    it("refuses a departure closed to sales, and a day or month over two years ahead", async () => {
      await slotRow().where({ id: tour.slotId }).update({ status: "closed" })
      const closed = await ask(request({ slot_id: tour.slotId }))
      expect([closed.status, closed.data.message]).toEqual([400, "booking.request_slot_invalid"])

      const far = new Date(Date.now() + 3 * 365 * DAY).toISOString()
      const day = await ask(request({ date: far.slice(0, 10) }))
      expect([day.status, day.data.message]).toEqual([400, "booking.request_when_invalid"])
      const month = await ask(request({ month: far.slice(0, 7) }))
      expect([month.status, month.data.message]).toEqual([400, "booking.request_when_invalid"])
    })

    it("finds a request left with a phone only by that phone, for KVKK and in the panel", async () => {
      expect((await ask(request({ note: "Arayın" }))).status).toBe(202)
      const container = getContainer()
      const typed = `+90 ${phone.slice(1)}`

      const copy = await contactMessagesFor(container, "cus_yok", [typed])
      expect(copy).toEqual([
        expect.objectContaining({ konu: "booking", ürün: tour.productId, body: "Arayın" }),
      ])
      expect(await contactMessagesFor(container, "cus_yok", ["0555 000 00 00"])).toEqual([])

      const found = await listFor(`phone=${encodeURIComponent(phone.replace(/ /g, ""))}`)
      expect(found.map((row) => row.product_id)).toEqual([tour.productId])
      expect(await listFor("phone=05550000000")).toEqual([])
      expect(await listFor("phone=12")).toEqual([])

      expect(await eraseContactMessages(container, "cus_yok", [phone])).toBe(1)
      expect(await listFor("subject=booking")).toEqual([])
    })

    it("needs a phone, the consent, and no more people than the product's cap", async () => {
      expect((await ask(request({ phone: undefined }))).status).toBe(400)
      expect((await ask(request({ consent: false }))).status).toBe(400)
      expect((await ask(request({ consent: undefined }))).status).toBe(400)
      const many = await ask(request({ adults: 5, children: 2 }))
      expect([many.status, many.data.message]).toEqual([400, "booking.request_people_invalid"])
    })
  },
})

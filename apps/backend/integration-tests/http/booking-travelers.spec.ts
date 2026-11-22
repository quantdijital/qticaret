import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createApiKeysWorkflow,
  createCartWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { forgetTravelers } from "../../src/workflows/booking/traveler-retention"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import { BANK_TRANSFER } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface TravelersAnswer {
  needs: { slot_id: string; level: string; count: number }[]
  travelers: Record<string, unknown>[]
  complete: boolean
}

const DAY = 24 * 60 * 60 * 1000
let made = 0

const traveler = (slotId: string, documentNo: string, extra: Record<string, string> = {}) => ({
  slot_id: slotId,
  first_name: "Ayşe",
  last_name: "Yılmaz",
  birth_date: "1990-01-15",
  document_no: documentNo,
  ...extra,
})

/** adr/0076 D6: a dated product's travelers, from the cart to the booking and the panel. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    let shop: StockShop

    const bookings = () => getContainer().resolve<BookingModuleService>(BOOKING_MODULE)
    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const post = (url: string, body: unknown, headers: Record<string, string> = store.headers) =>
      settle(http.post<Answer>(url, body, { headers }))
    const travelers = (cartId: string, list: unknown[], headers = store.headers) =>
      post(`/store/carts/${cartId}/travelers`, { travelers: list }, headers)
    const readTravelers = (cartId: string, headers: Record<string, string> = store.headers) =>
      settle(http.get<TravelersAnswer>(`/store/carts/${cartId}/travelers`, { headers }))

    const emptyCart = async (container: MedusaContainer) => {
      const { result } = await createCartWorkflow(container).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
          email: "ayse.yilmaz@example.com",
          shipping_address: PAYTR_ADDRESS,
          billing_address: PAYTR_ADDRESS,
        },
      })
      return result.id
    }

    /** A published tour asking for travelers at `level`: an adult (1 place), an infant (none). */
    const tour = async (level: string) => {
      const { data } = await http.post<{
        product: { id: string; variants: { id: string; title: string }[] }
      }>(
        "/admin/products",
        {
          title: `Efes turu ${String((made += 1))}`,
          status: "draft",
          options: [{ title: "Kişi", values: ["Yetişkin", "Bebek"] }],
          variants: ["Yetişkin", "Bebek"].map((title) => ({
            title,
            options: { Kişi: title },
            prices: [{ currency_code: "try", amount: title === "Bebek" ? 100 : 900 }],
          })),
          sales_channels: [{ id: shop.salesChannelId }],
        },
        { headers: admin.headers }
      )
      const productId = data.product.id
      const variantOf = (title: string) =>
        data.product.variants.find((variant) => variant.title === title)?.id ?? ""
      const adult = variantOf("Yetişkin")
      const infant = variantOf("Bebek")
      await staff(`/admin/products/${productId}/catalog`, {
        kind: "service",
        booking_mode: "departure",
      })
      await staff(`/admin/products/${productId}`, { status: "published" })
      await staff(`/admin/products/${productId}/bookable`, {
        traveler_fields: { level },
        pax_by_variant: { [infant]: { pax: 0, max_age: 2 } },
      })
      const slots = await staff(`/admin/products/${productId}/booking-slots`, {
        slots: [{ starts_at: new Date(Date.now() + 10 * DAY).toISOString(), capacity: 10 }],
      })
      const slotId = ((slots.data["slots"] as { id: string }[] | undefined) ?? [])[0]?.id ?? ""
      return { productId, adult, infant, slotId }
    }

    /** A publishable key of another storefront (its own sales channel). */
    const otherStorefront = async (container: MedusaContainer) => {
      const { result: channels } = await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name: `Diğer vitrin ${String((made += 1))}` }] },
      })
      const { result: keys } = await createApiKeysWorkflow(container).run({
        input: { api_keys: [{ title: "other", type: "publishable", created_by: "" }] },
      })
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: keys[0]?.id ?? "", add: [channels[0]?.id ?? ""] },
      })
      return { "x-publishable-api-key": keys[0]?.token ?? "" }
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await staff("/admin/platform-settings/bank_transfer", {
        enabled: true,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "TR330006100519786457841326",
        deadline_hours: 24,
      })
    })
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("answers as missing while the flag is off (K11)", async () => {
      const cartId = await emptyCart(getContainer())
      const read = await readTravelers(cartId)
      const write = await travelers(cartId, [])
      expect([read.status, write.status]).toEqual([404, 404])
    })

    it("asks for the places' travelers, refuses paying without them and books them with the order", async () => {
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      const container = getContainer()
      const { productId, adult, infant, slotId } = await tour("identity")
      const cartId = await emptyCart(container)
      await post(`/store/carts/${cartId}/bookings`, {
        slot_id: slotId,
        items: [
          { variant_id: adult, quantity: 2 },
          { variant_id: infant, quantity: 1 },
        ],
      })
      const pay = () =>
        post(`/store/carts/${cartId}/payment-session`, { provider_id: BANK_TRANSFER })

      const asked = await readTravelers(cartId)
      const unpaid = await pay()
      const tooFew = await travelers(cartId, [traveler(slotId, "U12345678")])
      const unasked = await travelers(cartId, [
        traveler(slotId, "U12345678", { nationality: "TR" }),
        traveler(slotId, "98765432101"),
      ])
      const saved = await travelers(cartId, [
        traveler(slotId, "u 1234-5678"),
        traveler(slotId, "98765432101", { first_name: "Mehmet" }),
      ])
      const started = await pay()
      // The product asks more after the payment started: the completion stops
      await staff(`/admin/products/${productId}/bookable`, {
        traveler_fields: { level: "nationality" },
      })
      const refused = await post(`/store/carts/${cartId}/complete`, {})
      const unsold = (await bookings().slotAvailability([slotId]))[0]
      await travelers(cartId, [
        traveler(slotId, "U12345678", { nationality: "tr" }),
        traveler(slotId, "98765432101", { first_name: "Mehmet", nationality: "DE" }),
      ])
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id: string } | undefined)?.id ?? ""
      const booked = await eventually(
        async () => (await bookings().listBookings({ order_id: orderId }))[0],
        (booking) => booking !== undefined
      )
      const rows = await eventually(
        () => bookings().listBookingTravelers({ booking_id: booked?.id ?? "" }),
        (list) => list.length === 2
      )

      expect(asked.status).toBe(200)
      // Two adults take a place each, the infant none: two travelers
      expect(asked.data).toMatchObject({
        needs: [{ slot_id: slotId, level: "identity", count: 2 }],
        travelers: [],
        complete: false,
      })
      expect([unpaid.status, unpaid.data.message]).toEqual([400, "booking.travelers_missing"])
      expect([tooFew.status, tooFew.data.message]).toEqual([400, "booking.travelers_invalid"])
      expect([unasked.status, unasked.data.message]).toEqual([400, "booking.travelers_invalid"])
      expect(saved.status).toBe(200)
      expect(saved.data["complete"]).toBe(true)
      expect(saved.data["travelers"]).toEqual([
        expect.objectContaining({ position: 0, first_name: "Ayşe", document_masked: "***5678" }),
        expect.objectContaining({ position: 1, first_name: "Mehmet", document_masked: "***2101" }),
      ])
      // The number goes back only masked
      expect(JSON.stringify(saved.data)).not.toContain("12345678")
      expect(started.status).toBe(200)
      expect([refused.status, refused.data.message]).toEqual([400, "booking.travelers_missing"])
      expect(unsold).toMatchObject({ sold: 0 })
      expect(placed.data["type"]).toBe("order")
      expect(rows.map((row) => [row.first_name, row.nationality, row.document_last4])).toEqual(
        expect.arrayContaining([
          ["Ayşe", "TR", "5678"],
          ["Mehmet", "DE", "2101"],
        ])
      )
      // Sealed in the table, never plain; nothing of a person on the order's lines
      expect(JSON.stringify(rows)).not.toContain("U12345678")
      const { data: order } = await http.get<{ order: { items: { metadata: unknown }[] } }>(
        `/admin/orders/${orderId}?fields=items.metadata`,
        { headers: admin.headers }
      )
      expect(JSON.stringify(order.order.items)).not.toMatch(/Ayşe|Mehmet|U12345678|98765432101/)

      // The panel's list: the travelers, the number masked, a recorded read
      const listed = await settle(
        http.get<{ bookings: { travelers: Record<string, unknown>[] }[] }>(
          `/admin/booking-slots/${slotId}/bookings`,
          { headers: admin.headers }
        )
      )
      const audit = getContainer().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
      const listRead = await audit.listAuditEntries({
        kind: "sensitive_read",
        resource_type: "booking_slot",
        resource_id: slotId,
      })
      expect(listed.status).toBe(200)
      expect(listed.data.bookings[0]?.travelers).toEqual([
        expect.objectContaining({
          first_name: "Ayşe",
          nationality: "TR",
          document_masked: "***5678",
        }),
        expect.objectContaining({ first_name: "Mehmet", document_masked: "***2101" }),
      ])
      expect(JSON.stringify(listed.data)).not.toMatch(/U12345678|document_encrypted|document_hash/)
      expect(listRead.length).toBeGreaterThan(0)

      // The full number: owner and admin, proved again, recorded first
      const ayse = rows.find((row) => row.first_name === "Ayşe")?.id ?? ""
      const ops = await createAdminUser(http, container, "operations")
      const reveal = (headers: Record<string, string>) =>
        settle(http.post<Answer>(`/admin/booking-travelers/${ayse}/reveal`, {}, { headers }))
      const bare = await reveal(admin.plain)
      const byOps = await reveal(ops.headers)
      const shown = await reveal(admin.headers)
      const unknown = await settle(
        http.post<Answer>(
          "/admin/booking-travelers/bktrv_nope/reveal",
          {},
          {
            headers: admin.headers,
          }
        )
      )
      const [entry] = await audit.listAuditEntries({ resource_id: ayse, kind: "sensitive_read" })

      expect(bare.status).toBe(428)
      expect(byOps.status).toBe(403)
      expect(shown.status).toBe(200)
      expect(shown.data["document_no"]).toBe("U12345678")
      expect(shown.headers["cache-control"]).toBe("no-store")
      expect(unknown.status).toBe(404)
      expect(entry).toMatchObject({
        action: "POST /admin/booking-travelers/:id/reveal",
        resource_type: "booking_traveler",
      })
    })

    it("shows another storefront's cart as missing", async () => {
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      const container = getContainer()
      const { adult, slotId } = await tour("name")
      const cartId = await emptyCart(container)
      await post(`/store/carts/${cartId}/bookings`, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 1 }],
      })
      const other = await otherStorefront(container)

      const read = await readTravelers(cartId, other)
      const write = await travelers(
        cartId,
        [{ slot_id: slotId, first_name: "A", last_name: "B" }],
        other
      )
      const own = await travelers(cartId, [
        { slot_id: slotId, first_name: "Ali", last_name: "Kaya" },
      ])

      expect([read.status, read.data.message]).toEqual([404, "cart.unknown"])
      expect([write.status, write.data.message]).toEqual([404, "cart.unknown"])
      expect(own.status).toBe(200)
    })

    it("deletes an abandoned cart's travelers and those past their period", async () => {
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      const container = getContainer()
      const { adult, slotId } = await tour("name")
      const cartId = await emptyCart(container)
      await post(`/store/carts/${cartId}/bookings`, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 1 }],
      })
      await travelers(cartId, [{ slot_id: slotId, first_name: "Ali", last_name: "Kaya" }])

      const tomorrow = await forgetTravelers(container, new Date(Date.now() + DAY))
      const kept = await bookings().listBookingTravelers({ cart_id: cartId })
      const later = await forgetTravelers(container, new Date(Date.now() + 3 * DAY))
      const gone = await bookings().listBookingTravelers({ cart_id: cartId })

      expect(tomorrow).toEqual({ past: 0, unbooked: 0 })
      expect(kept).toHaveLength(1)
      expect(later).toEqual({ past: 0, unbooked: 1 })
      expect(gone).toHaveLength(0)
    })
  },
})

import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { processDepartureCancel } from "../../src/workflows/booking/departure-cancel"
import { createAdminUser } from "../helpers/admin"
import { emptyCart, payByPaytr, publishTour } from "../helpers/booking-tour"
import type { Tour } from "../helpers/booking-tour"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { connectPaytr } from "../helpers/paytr"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(300 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface Departure {
  slot_id: string
  cancelled: boolean
  cancellable: boolean
  fee_percent: number | null
  refund: string
}

const DAY = 24 * 60 * 60 * 1000
// Ten days ahead keeps 20%, 30 days or more 10% (0% for a package travel seller)
const TIERS = [
  { days_before: 30, fee_percent: 10 },
  { days_before: 7, fee_percent: 20 },
  { days_before: 0, fee_percent: 100 },
]
// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()

/**
 * adr/0076 D7a: a dated order's departure cancelled by its shopper (the
 * tier's refund, once), one departure of two, and a whole departure
 * cancelled by the shop with everything back; the refund worked out on
 * the server, never sent; another's order is no order; roles.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let customer: TestCustomer
    let tour: Tour

    const bookings = () => getContainer().resolve<BookingModuleService>(BOOKING_MODULE)
    const ledger = () => getContainer().resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const staff = (url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<Answer>(url, body, { headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const book = (cartId: string, slotId: string, quantity: number) =>
      settle(
        http.post<Answer>(
          `/store/carts/${cartId}/bookings`,
          { slot_id: slotId, items: [{ variant_id: tour.adult, quantity }] },
          { headers: store.headers }
        )
      )
    const sold = async (slotId: string) =>
      (await bookings().listBookingSlots({ id: slotId }))[0]?.sold
    const refundsOf = (orderId: string) => ledger().listOrderRefunds({ order_id: orderId })

    /**
     * A dated order paid by card through PayTR's form (only a hosted card
     * form is refunded on its own), made `owner`'s.
     */
    const datedOrder = async (owner: TestCustomer, lines: [string, number][]) => {
      const container = getContainer()
      const cartId = await emptyCart(container, shop)
      for (const [slotId, quantity] of lines) {
        expect((await book(cartId, slotId, quantity)).status).toBe(200)
      }
      const orderId = await payByPaytr(http, container, fake, store.headers, cartId)
      await container.resolve(Modules.ORDER).updateOrders(orderId, { customer_id: owner.id })
      await eventually(
        () => bookings().listBookings({ order_id: orderId }),
        (list) => list.length === 1
      )
      return orderId
    }
    const departures = async (orderId: string, who = customer) =>
      settle(
        http.get<{ departures: Departure[] } & Answer>(`/store/orders/${orderId}/bookings`, {
          headers: who.headers,
        })
      )
    const cancel = (orderId: string, body: Record<string, unknown>, who = customer) =>
      settle(
        http.post<{ cancelled: boolean; refunded: string } & Answer>(
          `/store/orders/${orderId}/bookings/cancel`,
          body,
          { headers: who.headers }
        )
      )

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
      store = await createStorefront(container)
      admin = await connectPaytr(http, container, account)
      customer = await registerCustomer(http, store)
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      tour = await publishTour(http, admin.headers, shop, "none")
      await staff(`/admin/products/${tour.productId}/bookable`, { cancellation_tiers: TIERS })
    })
    afterEach(async () => {
      await staff("/admin/platform-settings/returns", { package_travel: false })
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("previews the tier's refund, cancels once and gives the places back", async () => {
      const orderId = await datedOrder(customer, [[tour.slotId, 2]])
      const stranger = await registerCustomer(http, store)

      const preview = await departures(orderId)
      const theirs = await departures(orderId, stranger)
      const strangerCancel = await cancel(orderId, { slot_id: tour.slotId }, stranger)
      const whole = await settle(
        http.post<Answer>(`/store/orders/${orderId}/cancel`, {}, { headers: customer.headers })
      )
      const priced = await cancel(orderId, { slot_id: tour.slotId, amount: 1800 })
      const first = await cancel(orderId, { slot_id: tour.slotId })
      const again = await cancel(orderId, { slot_id: tour.slotId })
      const refunds = await refundsOf(orderId)

      expect(preview.data.departures).toEqual([
        expect.objectContaining({
          slot_id: tour.slotId,
          cancellable: true,
          fee_percent: 20,
          refund: "1440.00",
        }),
      ])
      expect([theirs.status, strangerCancel.status]).toEqual([404, 404])
      expect(whole.data.message).toBe("booking.use_booking_cancel")
      expect(priced.status).toBe(400)
      expect(first.data).toEqual(expect.objectContaining({ cancelled: true, refunded: "1440.00" }))
      expect(again.data).toEqual(expect.objectContaining({ cancelled: false, refunded: "1440.00" }))
      expect(refunds).toHaveLength(1)
      expect([refunds[0]?.amount, refunds[0]?.status]).toEqual([144000, "done"])
      expect(refunds[0]?.reference.startsWith("booking")).toBe(true)
      expect(await sold(tour.slotId)).toBe(0)
      expect((await bookings().listBookings({ order_id: orderId }))[0]?.status).toBe("cancelled")
      expect((await departures(orderId)).data.departures[0]?.cancelled).toBe(true)
    })

    it("cancels one departure of two; a package travel seller keeps nothing 30 days ahead", async () => {
      const far = await staff(`/admin/products/${tour.productId}/booking-slots`, {
        slots: [{ starts_at: new Date(Date.now() + 40 * DAY).toISOString(), capacity: 10 }],
      })
      const farSlot = ((far.data["slots"] as { id: string }[] | undefined) ?? [])[0]?.id ?? ""
      const orderId = await datedOrder(customer, [
        [tour.slotId, 1],
        [farSlot, 2],
      ])
      const before = (await departures(orderId)).data.departures
      await staff("/admin/platform-settings/returns", { package_travel: true })
      const floor = (await departures(orderId)).data.departures

      const done = await cancel(orderId, { slot_id: farSlot })

      expect(before.find((row) => row.slot_id === farSlot)?.fee_percent).toBe(10)
      expect(floor.find((row) => row.slot_id === farSlot)).toEqual(
        expect.objectContaining({ fee_percent: 0, refund: "1800.00" })
      )
      expect(done.data).toEqual(expect.objectContaining({ cancelled: true, refunded: "1800.00" }))
      expect([await sold(tour.slotId), await sold(farSlot)]).toEqual([1, 0])
      expect((await bookings().listBookings({ order_id: orderId }))[0]?.status).toBe("confirmed")
    })

    it("cancels a whole departure with everything back, once, for owner and admin only", async () => {
      const first = await datedOrder(customer, [[tour.slotId, 1]])
      const second = await datedOrder(await registerCustomer(http, store), [[tour.slotId, 2]])
      const operations = await createAdminUser(http, getContainer(), "operations")
      const url = `/admin/booking-slots/${tour.slotId}/cancel`

      const preview = await settle(
        http.get<{ preview: Record<string, unknown> }>(url, { headers: admin.headers })
      )
      const plain = await staff(`/admin/booking-slots/${tour.slotId}`, { status: "cancelled" })
      const refused = await staff(url, {}, operations.headers)
      const staffOrderCancel = await staff(
        `/admin/orders/${first}/bookings/cancel`,
        { slot_id: tour.slotId, mode: "full" },
        operations.headers
      )
      const started = await staff(url, {})
      await processDepartureCancel(getContainer(), tour.slotId)
      await processDepartureCancel(getContainer(), tour.slotId)
      const again = await staff(url, {})

      expect(preview.data.preview).toEqual(
        expect.objectContaining({ bookings: 2, orders: 2, units: 3, refund: "2700.00" })
      )
      expect(plain.data.message).toBe("booking.use_departure_cancel")
      expect([refused.status, staffOrderCancel.status]).toEqual([403, 403])
      expect(started.status).toBe(200)
      expect(again.status).toBe(200)
      const firstRefunds = await refundsOf(first)
      const secondRefunds = await refundsOf(second)
      expect(firstRefunds.map((row) => row.amount)).toEqual([90000])
      expect(secondRefunds.map((row) => row.amount)).toEqual([180000])
      expect(await sold(tour.slotId)).toBe(0)
      expect((await bookings().listBookingSlots({ id: tour.slotId }))[0]?.status).toBe("cancelled")
      const reopen = await staff(`/admin/booking-slots/${tour.slotId}`, { status: "open" })
      expect(reopen.data.message).toBe("booking.slot_cancelled")
    })
  },
})

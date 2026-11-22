import { Modules } from "@medusajs/framework/utils"
import { createPaymentCollectionForCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { loadBookingConfirmed } from "../../src/workflows/messaging/loaders/booking"
import { createAdminUser } from "../helpers/admin"
import { emptyCart, publishTour } from "../helpers/booking-tour"
import type { Tour } from "../helpers/booking-tour"
import { completeWithSystemPayment } from "../helpers/checkout"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(300 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface Voucher {
  order_number: string
  status: string
  code: string
  departures: { title: string; when: string; units: number; cancelled: boolean }[]
}

const DAY = 24 * 60 * 60 * 1000
const TIERS = [
  { days_before: 7, fee_percent: 20 },
  { days_before: 0, fee_percent: 100 },
]

/**
 * adr/0076 D7b: a booking's confirmation e-mail data, its voucher for its
 * own shopper only, the staff's code check (every role that reads orders;
 * valid, cancelled, unknown) and which departures the reminder picks.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    let shop: StockShop
    let customer: TestCustomer
    let tour: Tour

    const bookings = () => getContainer().resolve<BookingModuleService>(BOOKING_MODULE)
    const staff = (url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<Answer>(url, body, { headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })

    /** A dated order of `units` places on the tour's departure, made `owner`'s. */
    const datedOrder = async (owner: TestCustomer, units: number) => {
      const container = getContainer()
      const cartId = await emptyCart(container, shop)
      const booked = await settle(
        http.post<Answer>(
          `/store/carts/${cartId}/bookings`,
          { slot_id: tour.slotId, items: [{ variant_id: tour.adult, quantity: units }] },
          { headers: store.headers }
        )
      )
      expect(booked.status).toBe(200)
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cartId },
      })
      const placed = await completeWithSystemPayment(container, cartId, collection.id)
      const orderId = placed.order_id ?? ""
      await container.resolve(Modules.ORDER).updateOrders(orderId, { customer_id: owner.id })
      const [booking] = await eventually(
        () => bookings().listBookings({ order_id: orderId }),
        (list) => list.length === 1
      )
      return { orderId, bookingId: booking?.id ?? "" }
    }
    const voucherOf = (orderId: string, headers: Record<string, string>) =>
      settle(
        http.get<{ vouchers: Voucher[] } & Answer>(`/store/orders/${orderId}/voucher`, { headers })
      )
    const check = (code: string, headers = admin.headers) =>
      settle(
        http.post<{ status: string; order_id?: string } & Answer>(
          "/admin/booking-vouchers/check",
          { code },
          { headers }
        )
      )

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      customer = await registerCustomer(http, store)
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      tour = await publishTour(http, admin.headers, shop, "none")
      await staff(`/admin/products/${tour.productId}/bookable`, { cancellation_tiers: TIERS })
    })
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("reads the confirmation's data from the booking: places, terms, no traveler", async () => {
      const { orderId, bookingId } = await datedOrder(customer, 2)
      const loaded = await loadBookingConfirmed(getContainer(), bookingId)
      expect(loaded?.recipients.email).toEqual(expect.any(String))
      expect(loaded?.resourceType).toBe("booking")
      expect(loaded?.vars.departures).toHaveLength(1)
      expect(loaded?.vars.departures[0]?.units).toBe(2)
      expect(loaded?.vars.terms).toEqual([
        { days: 7, percent: 20 },
        { days: 0, percent: 100 },
      ])
      // The confirmation made the voucher's code
      const [row] = await bookings().listBookings({ id: bookingId }, { select: ["voucher_code"] })
      expect(row?.voucher_code).toMatch(/^[0-9A-Z]{16}$/)
      const voucher = await voucherOf(orderId, customer.headers)
      expect(voucher.data.vouchers[0]?.code.replace(/-/g, "")).toBe(row?.voucher_code)
    })

    it("gives the voucher to the order's shopper only; anyone else finds no order", async () => {
      const { orderId } = await datedOrder(customer, 3)
      const own = await voucherOf(orderId, customer.headers)
      expect(own.status).toBe(200)
      const [voucher] = own.data.vouchers
      expect(voucher?.status).toBe("valid")
      expect(voucher?.code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/)
      expect(voucher?.departures[0]?.units).toBe(3)
      // Read again: the same code
      expect((await voucherOf(orderId, customer.headers)).data.vouchers[0]?.code).toBe(
        voucher?.code
      )
      const stranger = await registerCustomer(http, store)
      expect((await voucherOf(orderId, stranger.headers)).status).toBe(404)
      expect((await voucherOf(orderId, store.headers)).status).toBe(404)
    })

    it("checks a code for every role that reads orders: valid, cancelled, unknown", async () => {
      const { orderId, bookingId } = await datedOrder(customer, 1)
      const code = (await voucherOf(orderId, customer.headers)).data.vouchers[0]?.code ?? ""
      const valid = await check(code)
      expect(valid.status).toBe(200)
      expect(valid.data).toMatchObject({ status: "valid", order_id: orderId })
      // Typed loosely: lower case, no dashes
      expect((await check(code.replace(/-/g, "").toLowerCase())).data.status).toBe("valid")
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await check(code, operations.headers)).data.status).toBe("valid")
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      expect((await check(code, readonly.headers)).data.status).toBe("valid")
      expect((await check("0000-0000-0000-0000")).data).toEqual({ status: "unknown" })
      expect((await check("not a code")).data).toEqual({ status: "unknown" })
      await bookings().cancelBookingSlot(bookingId, tour.slotId)
      expect((await check(code)).data.status).toBe("cancelled")
      expect((await voucherOf(orderId, customer.headers)).data.vouchers[0]?.status).toBe(
        "cancelled"
      )
    })

    it("picks a live departure once for its reminder, never a cancelled one", async () => {
      const { bookingId } = await datedOrder(customer, 1)
      const [use] = await bookings().listBookingSlotUses({ booking_id: bookingId })
      const [slot] = await bookings().listBookingSlots({ id: tour.slotId })
      const startsAt = new Date(slot?.starts_at ?? 0).getTime()
      const dayBefore = new Date(startsAt - DAY)
      expect(await bookings().dueReminders(new Date(startsAt - 3 * DAY), 100)).not.toContain(
        use?.id
      )
      expect(await bookings().dueReminders(dayBefore, 100)).toContain(use?.id)
      expect(await bookings().markReminded(use?.id ?? "")).toBe(true)
      expect(await bookings().markReminded(use?.id ?? "")).toBe(false)
      expect(await bookings().dueReminders(dayBefore, 100)).not.toContain(use?.id)

      const second = await datedOrder(customer, 1)
      const [other] = await bookings().listBookingSlotUses({ booking_id: second.bookingId })
      await bookings().cancelBookingSlot(second.bookingId, tour.slotId)
      expect(await bookings().dueReminders(dayBefore, 100)).not.toContain(other?.id)
      // Off on the product: none
      await staff(`/admin/products/${tour.productId}/bookable`, { reminder_days: 0 })
      const third = await datedOrder(customer, 1)
      const [off] = await bookings().listBookingSlotUses({ booking_id: third.bookingId })
      expect(await bookings().dueReminders(dayBefore, 100)).not.toContain(off?.id)
    })
  },
})

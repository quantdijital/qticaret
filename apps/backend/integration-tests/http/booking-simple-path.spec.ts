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
interface Departure {
  slot_id: string
  cancelled: boolean
  cancellable: boolean
  refusal: string | null
}
interface Departures {
  departures: Departure[]
  contact?: { note: string | null; phone: string | null; email: string | null }
}

const TIERS = [
  { days_before: 7, fee_percent: 20 },
  { days_before: 0, fee_percent: 100 },
]

/**
 * adr/0076 Ek basit yol: a shop that runs its dated orders by phone and
 * e-mail. Vouchers off: no code made, no page, no link in the e-mail, its
 * note instead. Online cancel off: the shopper's cancel refused with
 * `booking.cancel_by_contact` and the shop's contacts given; staff's
 * cancel stays. With dated selling off the choice is ignored.
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
    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const flow = (values: Record<string, unknown>) =>
      staff("/admin/platform-settings/booking", values)

    const datedOrder = async () => {
      const container = getContainer()
      const cartId = await emptyCart(container, shop)
      const booked = await settle(
        http.post<Answer>(
          `/store/carts/${cartId}/bookings`,
          { slot_id: tour.slotId, items: [{ variant_id: tour.adult, quantity: 1 }] },
          { headers: store.headers }
        )
      )
      expect(booked.status).toBe(200)
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cartId },
      })
      const placed = await completeWithSystemPayment(container, cartId, collection.id)
      const orderId = placed.order_id ?? ""
      await container.resolve(Modules.ORDER).updateOrders(orderId, { customer_id: customer.id })
      const [booking] = await eventually(
        () => bookings().listBookings({ order_id: orderId }),
        (list) => list.length === 1
      )
      return { orderId, bookingId: booking?.id ?? "" }
    }
    const voucherOf = (orderId: string) =>
      settle(http.get<Answer>(`/store/orders/${orderId}/voucher`, { headers: customer.headers }))
    const departures = (orderId: string) =>
      settle(
        http.get<Departures & Answer>(`/store/orders/${orderId}/bookings`, {
          headers: customer.headers,
        })
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
      await flow({ voucher_enabled: true, online_cancel_enabled: true })
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("without vouchers makes no code, shows no page and puts the shop's note in the e-mail", async () => {
      const saved = await flow({ voucher_enabled: false, voucher_off_note: "Sizi arayacağız." })
      expect(saved.status).toBe(200)
      const { orderId, bookingId } = await datedOrder()
      const loaded = await loadBookingConfirmed(getContainer(), bookingId)
      expect(loaded?.vars.voucherUrl).toBeNull()
      expect(loaded?.vars.voucherOffNote).toBe("Sizi arayacağız.")
      expect((await voucherOf(orderId)).status).toBe(404)
      const [row] = await bookings().listBookings({ id: bookingId }, { select: ["voucher_code"] })
      expect(row?.voucher_code ?? null).toBeNull()
      // Turned back on: the voucher is there again, its code made on first read
      await flow({ voucher_enabled: true })
      expect((await voucherOf(orderId)).status).toBe(200)
      const again = await loadBookingConfirmed(getContainer(), bookingId)
      expect(again?.vars.voucherUrl).toContain("/voucher")
      expect(again?.vars.voucherOffNote).toBeNull()
    })

    it("without online cancel refuses the shopper's, gives the shop's contacts, keeps staff's", async () => {
      await staff("/admin/platform-settings/store", {
        contact_phone: "02125550000",
        contact_email: "tur@ornek.example",
      })
      await flow({ online_cancel_enabled: false })
      const { orderId } = await datedOrder()
      const view = await departures(orderId)
      expect(view.status).toBe(200)
      expect(view.data.departures[0]).toMatchObject({
        cancellable: false,
        refusal: "booking.cancel_by_contact",
      })
      expect(view.data.contact).toEqual({
        note: null,
        phone: expect.stringContaining("2125550000") as unknown,
        email: "tur@ornek.example",
      })
      const refused = await settle(
        http.post<Answer>(
          `/store/orders/${orderId}/bookings/cancel`,
          { slot_id: tour.slotId },
          { headers: customer.headers }
        )
      )
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("booking.cancel_by_contact")
      const loaded = await loadBookingConfirmed(
        getContainer(),
        (await bookings().listBookings({ order_id: orderId }))[0]?.id ?? ""
      )
      expect(loaded?.vars.onlineCancel).toBe(false)
      const byStaff = await staff(`/admin/orders/${orderId}/bookings/cancel`, {
        slot_id: tour.slotId,
        mode: "full",
      })
      expect(byStaff.status).toBe(200)
      expect(byStaff.data["cancelled"]).toBe(true)
    })

    it("ignores the choice while dated selling is off: the e-mail as before", async () => {
      await flow({ voucher_enabled: false, online_cancel_enabled: false })
      const { bookingId } = await datedOrder()
      await flag("catalog.booking", false)
      const loaded = await loadBookingConfirmed(getContainer(), bookingId)
      expect(loaded?.vars.voucherUrl).toContain("/voucher")
      expect(loaded?.vars.voucherOffNote).toBeNull()
      expect(loaded?.vars.onlineCancel).toBe(true)
    })
  },
})

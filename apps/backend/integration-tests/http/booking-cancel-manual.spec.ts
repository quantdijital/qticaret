import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  capturePaymentWorkflow,
  createPaymentCollectionForCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { createAdminUser } from "../helpers/admin"
import { emptyCart, publishTour } from "../helpers/booking-tour"
import type { Tour } from "../helpers/booking-tour"
import { completeWithSystemPayment } from "../helpers/checkout"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import { BANK_TRANSFER } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(300 * 1000)

type Answer = { message?: string } & Record<string, unknown>

const DAY = 24 * 60 * 60 * 1000
// Ten days ahead keeps 20%
const TIERS = [
  { days_before: 30, fee_percent: 10 },
  { days_before: 7, fee_percent: 20 },
  { days_before: 0, fee_percent: 100 },
]

/**
 * adr/0076 Ek D7a, security review of #273: money that is not sent on its
 * own (a bank transfer, gift card credit) is left to staff with the places
 * given back (O1, O2); an unpaid order goes with its last departure and a
 * transfer for a cancelled departure is refused (O3); the tiers sold are
 * the tiers reckoned (O5); a cancelled departure's cart holds go (D5).
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
    const slotRow = async (slotId: string) => (await bookings().listBookingSlots({ id: slotId }))[0]
    const staffCancel = (orderId: string, slotId: string, mode = "full") =>
      staff(`/admin/orders/${orderId}/bookings/cancel`, { slot_id: slotId, mode })
    const orderStatus = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["status"], filters: { id: orderId } })
      return (data as { status: string }[])[0]?.status
    }
    const bells = async (orderId: string) =>
      (
        await getContainer()
          .resolve(Modules.NOTIFICATION)
          .listNotifications({ resource_id: orderId }, { select: ["trigger_type"] })
      ).map((row) => row.trigger_type)
    const farSlot = async () => {
      const far = await staff(`/admin/products/${tour.productId}/booking-slots`, {
        slots: [{ starts_at: new Date(Date.now() + 40 * DAY).toISOString(), capacity: 10 }],
      })
      return ((far.data["slots"] as { id: string }[] | undefined) ?? [])[0]?.id ?? ""
    }

    /** A dated order placed by bank transfer, its money not yet in. */
    const transferOrder = async (lines: [string, number][]) => {
      const cartId = await emptyCart(getContainer(), shop)
      for (const [slotId, quantity] of lines) {
        expect((await book(cartId, slotId, quantity)).status).toBe(200)
      }
      await http.post(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: BANK_TRANSFER },
        { headers: store.headers }
      )
      const placed = await http.post<{ order: { id: string } }>(
        `/store/carts/${cartId}/complete`,
        {},
        { headers: store.headers }
      )
      const orderId = placed.data.order.id
      await eventually(
        () => bookings().listBookings({ order_id: orderId }),
        (list) => list.length === 1
      )
      return orderId
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      customer = await registerCustomer(http, store)
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      await staff("/admin/platform-settings/bank_transfer", {
        enabled: true,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "TR330006100519786457841326",
        deadline_hours: 24,
      })
      tour = await publishTour(http, admin.headers, shop, "none")
      await staff(`/admin/products/${tour.productId}/bookable`, { cancellation_tiers: TIERS })
    })
    afterEach(async () => {
      await flag("promotions.gift_cards", false)
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("leaves a confirmed bank transfer's refund to staff and gives the places back (O2)", async () => {
      const orderId = await transferOrder([[tour.slotId, 1]])
      expect((await staff(`/admin/orders/${orderId}/bank-transfer/confirm`, {})).status).toBe(200)

      const preview = await settle(
        http.get<{ preview: Record<string, unknown> }>(
          `/admin/booking-slots/${tour.slotId}/cancel`,
          { headers: admin.headers }
        )
      )
      const done = await staffCancel(orderId, tour.slotId)

      expect(preview.data.preview).toEqual(
        expect.objectContaining({ refund: "0.00", refund_by_hand: "900.00", by_hand_orders: 1 })
      )
      expect(done.data).toEqual(
        expect.objectContaining({
          cancelled: true,
          refunded: "0.00",
          refund_by_hand: "900.00",
          manual: "offline",
        })
      )
      expect(await ledger().listOrderRefunds({ order_id: orderId })).toEqual([])
      expect((await slotRow(tour.slotId))?.sold).toBe(0)
      expect(await bells(orderId)).toContain("booking.refund_by_hand")
    })

    it("cancels an unpaid order with its last departure and refuses a transfer for a cancelled one (O3)", async () => {
      const far = await farSlot()
      const orderId = await transferOrder([
        [tour.slotId, 1],
        [far, 1],
      ])

      const first = await staffCancel(orderId, tour.slotId)
      const refused = await staff(`/admin/orders/${orderId}/bank-transfer/confirm`, {})
      const statusBetween = await orderStatus(orderId)
      const last = await staffCancel(orderId, far)

      expect(first.data).toEqual(
        expect.objectContaining({ cancelled: true, refunded: "0.00", order_cancelled: false })
      )
      expect(refused.data.message).toBe("booking.departure_cancelled_unpaid")
      expect(statusBetween).not.toBe("canceled")
      expect(last.data).toEqual(expect.objectContaining({ cancelled: true, order_cancelled: true }))
      expect(await orderStatus(orderId)).toBe("canceled")
      expect(await ledger().listOrderRefunds({ order_id: orderId })).toEqual([])
    })

    it("never turns gift card credit into cash: the shopper is sent to the shop, staff refund by hand (O1)", async () => {
      await flag("promotions.gift_cards", true)
      const made = await http.post<{ gift_card: { code: string } }>(
        "/admin/gift-cards",
        { currency_code: "try", value: 400 },
        { headers: admin.headers }
      )
      const container = getContainer()
      const cartId = await emptyCart(container, shop)
      expect((await book(cartId, tour.slotId, 1)).status).toBe(200)
      await http.post(
        `/store/carts/${cartId}/gift-cards`,
        { code: made.data.gift_card.code },
        { headers: store.headers }
      )
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cartId },
      })
      const orderId =
        (await completeWithSystemPayment(container, cartId, collection.id)).order_id ?? ""
      await container.resolve(Modules.ORDER).updateOrders(orderId, { customer_id: customer.id })
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const order = (data as { payment_collections: { payments: { id: string }[] }[] }[])[0]
      await capturePaymentWorkflow(container).run({
        input: { payment_id: order?.payment_collections[0]?.payments[0]?.id ?? "" },
      })
      await eventually(
        () => bookings().listBookings({ order_id: orderId }),
        (list) => list.length === 1
      )

      const mine = await settle(
        http.post<Answer>(
          `/store/orders/${orderId}/bookings/cancel`,
          { slot_id: tour.slotId },
          { headers: customer.headers }
        )
      )
      const done = await staffCancel(orderId, tour.slotId)

      expect(mine.data.message).toBe("orders.cancel_contact_shop")
      expect(done.data).toEqual(
        expect.objectContaining({ cancelled: true, refunded: "0.00", manual: "credit" })
      )
      expect(Number(done.data["refund_by_hand"])).toBeGreaterThan(0)
      expect(await ledger().listOrderRefunds({ order_id: orderId })).toEqual([])
      expect(await bells(orderId)).toContain("booking.refund_by_hand")
    })

    it("reckons a cancel by the tiers the booking was sold under (O5)", async () => {
      const orderId = await transferOrder([[tour.slotId, 1]])
      expect((await staff(`/admin/orders/${orderId}/bank-transfer/confirm`, {})).status).toBe(200)
      await staff(`/admin/products/${tour.productId}/bookable`, {
        cancellation_tiers: [{ days_before: 0, fee_percent: 100 }],
      })

      const [use] = await bookings().listBookingSlotUses({ slot_id: tour.slotId })
      const preview = await settle(
        http.get<{ departures: { fee_percent: number | null }[] }>(
          `/admin/orders/${orderId}/bookings?mode=tier`,
          { headers: admin.headers }
        )
      )

      const copied = use?.cancellation as { timezone?: string; tiers?: unknown[] } | null
      expect(copied?.timezone).toBe("Europe/Istanbul")
      expect(copied?.tiers).toHaveLength(TIERS.length)
      expect(preview.data.departures[0]?.fee_percent).toBe(20)
    })

    it("gives up carts' holds on a cancelled departure; their checkout refuses (D5)", async () => {
      const container = getContainer()
      const cartId = await emptyCart(container, shop)
      expect((await book(cartId, tour.slotId, 2)).status).toBe(200)
      const heldBefore = (await slotRow(tour.slotId))?.held

      expect((await staff(`/admin/booking-slots/${tour.slotId}/cancel`, {})).status).toBe(200)
      // Refused at the payment's start or at the completion, whichever checks first
      const placed = await (async () => {
        try {
          const { result: collection } = await createPaymentCollectionForCartWorkflow(
            container
          ).run({ input: { cart_id: cartId } })
          return (await completeWithSystemPayment(container, cartId, collection.id)).order_id
        } catch {
          return null
        }
      })()

      expect(heldBefore).toBe(2)
      expect((await slotRow(tour.slotId))?.held).toBe(0)
      expect(placed).toBeNull()
      expect(await bookings().listBookings({})).toEqual([])
    })
  },
})

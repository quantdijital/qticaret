import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { createAdminUser } from "../helpers/admin"
import { emptyCart, publishTour } from "../helpers/booking-tour"
import type { Tour } from "../helpers/booking-tour"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(300 * 1000)

type Answer = { message?: string } & Record<string, unknown>

const COD = "pp_cod_cod"
let made = 0

/**
 * Refund safety follow-ups of adr/0076 (D7a and D7b security reviews): a
 * partial capture counts as money taken and is refused through Medusa's
 * route for our checkout's ways; a cancel keeps how its money went back;
 * cash on delivery collected for a parcel is recorded after one of the
 * order's departures was cancelled, the departure's share owed by hand.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    let shop: StockShop
    let tour: Tour
    let knife: string

    const bookings = () => getContainer().resolve<BookingModuleService>(BOOKING_MODULE)
    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const shopper = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: store.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const bells = async (orderId: string) =>
      (
        await getContainer()
          .resolve(Modules.NOTIFICATION)
          .listNotifications({ resource_id: orderId }, { select: ["trigger_type"] })
      ).map((row) => row.trigger_type)
    const useOf = async (orderId: string) => {
      const [booking] = await bookings().listBookings({ order_id: orderId })
      const [use] = await bookings().listBookingSlotUses({ booking_id: booking?.id ?? "" })
      return use
    }
    const paymentOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["payment_collections.payments.id"],
          filters: { id: orderId },
        })
      const rows = data as unknown as { payment_collections?: { payments?: { id: string }[] }[] }[]
      return rows[0]?.payment_collections?.[0]?.payments?.[0]?.id ?? ""
    }

    /** A knife and a place on the tour, paid at the door. */
    const cashOrder = async () => {
      const cartId = await emptyCart(getContainer(), shop)
      expect(
        (await shopper(`/store/carts/${cartId}/line-items`, { variant_id: knife, quantity: 1 }))
          .status
      ).toBe(200)
      await shopper(`/store/carts/${cartId}/shipping-methods`, { option_id: shop.shippingOptionId })
      expect(
        (
          await shopper(`/store/carts/${cartId}/bookings`, {
            slot_id: tour.slotId,
            items: [{ variant_id: tour.adult, quantity: 1 }],
          })
        ).status
      ).toBe(200)
      expect(
        (await shopper(`/store/carts/${cartId}/payment-session`, { provider_id: COD })).status
      ).toBe(200)
      const placed = await shopper(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id?: string } | undefined)?.id ?? ""
      expect(orderId).not.toBe("")
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
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
      const saved = await staff("/admin/platform-settings/cash_on_delivery", {
        fee_type: "none",
        fee_value: 0,
        max_amount: 0,
        shipping_option_ids: [shop.shippingOptionId],
      })
      expect(saved.status).toBe(200)
      expect((await flag("payments.cash_on_delivery", true)).status).toBe(200)
      tour = await publishTour(http, admin.headers, shop, "none")
      knife = (await stockedProduct(container, shop, `bicak-${String((made += 1))}`, 5, 100))
        .variantId
    })
    afterEach(async () => {
      await flag("payments.cash_on_delivery", false)
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("refuses a partial capture of cash on delivery through Medusa's route", async () => {
      const orderId = await cashOrder()

      const partial = await staff(`/admin/payments/${await paymentOf(orderId)}/capture`, {
        amount: 100,
      })

      expect(partial.status).toBe(400)
      expect(partial.data.message).toBe("payments.partial_capture_refused")
    })

    it("counts money captured in part as taken: the departure's refund is left to staff", async () => {
      const orderId = await cashOrder()
      // Part of it taken some other way than our route (Medusa's own workflow)
      await capturePaymentWorkflow(getContainer()).run({
        input: { payment_id: await paymentOf(orderId), amount: 500 },
      })

      const done = await staff(`/admin/orders/${orderId}/bookings/cancel`, {
        slot_id: tour.slotId,
        mode: "full",
      })

      expect(done.data).toEqual(
        expect.objectContaining({ cancelled: true, refunded: "0.00", manual: "offline" })
      )
      expect((await useOf(orderId))?.cancel_refund).toBe("offline")
      expect(await bells(orderId)).toContain("booking.refund_by_hand")
    })

    it("records cash collected for the parcel after the departure was cancelled, its share owed by hand", async () => {
      const orderId = await cashOrder()
      const cancelled = await staff(`/admin/orders/${orderId}/bookings/cancel`, {
        slot_id: tour.slotId,
        mode: "full",
      })
      const keptBefore = (await useOf(orderId))?.cancel_refund
      const bellsBefore = await bells(orderId)

      const captured = await staff(`/admin/payments/${await paymentOf(orderId)}/capture`, {})

      expect(cancelled.data).toEqual(
        expect.objectContaining({ cancelled: true, refunded: "0.00", order_cancelled: false })
      )
      expect(keptBefore).toBe("none")
      expect(bellsBefore).not.toContain("booking.refund_by_hand")
      expect(captured.status).toBe(200)
      // Written once the capture went through, after the answer (review O1, O2 of #277)
      const marked = await eventually(
        () => useOf(orderId),
        (use) => use?.cancel_refund === "offline"
      )
      // The tour's 900 TL, worked out on the server: the shop cancelled nothing, staff gave all back
      expect(marked?.refund_due).toBe(90000)
      await eventually(
        () => bells(orderId),
        (rung) => rung.includes("booking.cash_share_by_hand")
      )
      expect(await bells(orderId)).not.toContain("booking.refund_by_hand")
    })
  },
})

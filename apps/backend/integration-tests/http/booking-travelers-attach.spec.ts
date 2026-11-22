import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { purgeAfterOf } from "../../src/lib/booking/travelers"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { reconcileTravelers } from "../../src/workflows/booking/reconcile-travelers"
import { forgetTravelers } from "../../src/workflows/booking/traveler-retention"
import { createAdminUser } from "../helpers/admin"
import { emptyCart, publishTour, traveler } from "../helpers/booking-tour"
import { eventually } from "../helpers/eventually"
import { BANK_TRANSFER } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

type Answer = { message?: string } & Record<string, unknown>

const DAY = 24 * 60 * 60 * 1000

/**
 * adr/0076 D6 security review: a booking keeps only the travelers it took
 * (O2), travelers that missed their booking are attached again (O1), an
 * abandoned cart's are deleted only under its lock (D3) and a departure's
 * new date moves their deletion date (D4).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    let shop: StockShop

    const bookings = () => getContainer().resolve<BookingModuleService>(BOOKING_MODULE)
    const knex = () => getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const post = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: store.headers }))
    const travelers = (cartId: string, list: unknown[]) =>
      post(`/store/carts/${cartId}/travelers`, { travelers: list })
    const tour = (level: string) => publishTour(http, admin.headers, shop, level)
    const book = (cartId: string, slotId: string, variantId: string) =>
      post(`/store/carts/${cartId}/bookings`, {
        slot_id: slotId,
        items: [{ variant_id: variantId, quantity: 1 }],
      })

    /** The cart paid by bank transfer and completed; its order's booking, once written. */
    const placeOrder = async (cartId: string) => {
      await post(`/store/carts/${cartId}/payment-session`, { provider_id: BANK_TRANSFER })
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id: string } | undefined)?.id ?? ""
      const booking = await eventually(
        async () => (await bookings().listBookings({ order_id: orderId }))[0],
        (found) => found !== undefined
      )
      return { orderId, bookingId: booking?.id ?? "" }
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
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
    })
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("books only the departures and fields the booking took; the rest is deleted (O2)", async () => {
      const container = getContainer()
      const kept = await tour("identity")
      const dropped = await tour("name")
      const cartId = await emptyCart(container, shop)
      await book(cartId, kept.slotId, kept.adult)
      await book(cartId, dropped.slotId, dropped.adult)
      const saved = await travelers(cartId, [
        traveler(kept.slotId, "U12345678"),
        { slot_id: dropped.slotId, first_name: "Ali", last_name: "Kaya" },
      ])
      // The second departure leaves the cart; its traveler is not sent again
      const removed = await settle(
        http.delete<Answer>(`/store/carts/${cartId}/bookings/${dropped.slotId}`, {
          headers: store.headers,
        })
      )
      // The first product asks less now: its number and birth date are no longer needed
      await staff(`/admin/products/${kept.productId}/bookable`, {
        traveler_fields: { level: "name" },
      })
      const { bookingId } = await placeOrder(cartId)
      const booked = await eventually(
        () => bookings().listBookingTravelers({ booking_id: bookingId }),
        (list) => list.length === 1
      )
      const left = await bookings().listBookingTravelers({ cart_id: cartId })

      expect(saved.status).toBe(200)
      expect(removed.status).toBe(200)
      expect(booked).toEqual([
        expect.objectContaining({
          slot_id: kept.slotId,
          first_name: "Ayşe",
          birth_date: null,
          document_encrypted: null,
          document_hash: null,
          document_last4: null,
          key_version: null,
        }),
      ])
      expect(left.map((row) => row.slot_id)).toEqual([kept.slotId])
    })

    it("attaches travelers that missed their booking again, once (O1)", async () => {
      const container = getContainer()
      const { adult, slotId } = await tour("name")
      const cartId = await emptyCart(container, shop)
      await book(cartId, slotId, adult)
      await travelers(cartId, [{ slot_id: slotId, first_name: "Ali", last_name: "Kaya" }])
      const { bookingId } = await placeOrder(cartId)
      await eventually(
        () => bookings().listBookingTravelers({ booking_id: bookingId }),
        (list) => list.length === 1
      )
      // As if the confirmation's attachment had failed, some minutes ago
      await knex().raw(`UPDATE booking_traveler SET booking_id = NULL WHERE cart_id = ?`, [cartId])
      await knex().raw(
        `UPDATE booking SET created_at = now() - interval '10 minutes' WHERE id = ?`,
        [bookingId]
      )

      const first = await reconcileTravelers(container)
      const again = await reconcileTravelers(container)
      const rows = await bookings().listBookingTravelers({ cart_id: cartId })

      expect(first).toEqual({ attached: 1, failed: 0, given_up: 0 })
      expect(again).toEqual({ attached: 0, failed: 0, given_up: 0 })
      expect(rows.map((row) => row.booking_id)).toEqual([bookingId])
    })

    it("passes over an abandoned cart whose lock is held, deletes it after (D3)", async () => {
      const container = getContainer()
      const { adult, slotId } = await tour("name")
      const cartId = await emptyCart(container, shop)
      await book(cartId, slotId, adult)
      await travelers(cartId, [{ slot_id: slotId, first_name: "Ali", last_name: "Kaya" }])
      const locking = container.resolve(Modules.LOCKING)
      const later = new Date(Date.now() + 3 * DAY)

      await locking.acquire(cartId, { ownerId: "completion", expire: 30 })
      const busy = await forgetTravelers(container, later)
      await locking.release(cartId, { ownerId: "completion" })
      const free = await forgetTravelers(container, later)

      expect(busy).toEqual({ past: 0, unbooked: 0 })
      expect(free).toEqual({ past: 0, unbooked: 1 })
      expect(await bookings().listBookingTravelers({ cart_id: cartId })).toHaveLength(0)
    })

    it("moves the travelers' deletion date with their departure's (D4)", async () => {
      const container = getContainer()
      const { adult, slotId } = await tour("name")
      const cartId = await emptyCart(container, shop)
      await book(cartId, slotId, adult)
      await travelers(cartId, [{ slot_id: slotId, first_name: "Ali", last_name: "Kaya" }])
      const startsAt = new Date(Date.now() + 40 * DAY)

      await bookings().updateSlot(slotId, { starts_at: startsAt })
      const [row] = await bookings().listBookingTravelers({ cart_id: cartId })

      expect(new Date(row?.purge_after ?? 0).getTime()).toBe(purgeAfterOf(startsAt, null).getTime())
    })
  },
})

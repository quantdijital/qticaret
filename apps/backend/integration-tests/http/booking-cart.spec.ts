import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelOrderWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { resetClientIpSecret } from "../../src/api/http/client-ip"
import {
  CLIENT_IP_HEADERS,
  CLIENT_IP_UNKNOWN,
  signClientIp,
} from "../../src/lib/security/client-ip"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { reconcileBookings } from "../../src/workflows/booking/reconcile"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import { BANK_TRANSFER } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface BookingLine {
  id: string
  variant_id: string
  quantity: number
  unit_price: number
  slot_id: string
}
interface BookingAnswer {
  booking: { slot_id: string; units: number }
  hold: { expires_at: string } | null
  lines: BookingLine[]
}

const DAY = 24 * 60 * 60 * 1000
let made = 0

// Read lazily by `clientIp`, so setting it before the first request is enough
const SECRET = `storefront-ip-${randomUUID()}`
process.env["STOREFRONT_IP_SECRET"] = SECRET

const signedAs = (ip: string): Record<string, string> => {
  const time = Math.floor(Date.now() / 1000)
  return {
    [CLIENT_IP_HEADERS.ip]: ip,
    [CLIENT_IP_HEADERS.time]: String(time),
    [CLIENT_IP_HEADERS.signature]: signClientIp(SECRET, ip, time),
  }
}

/** adr/0076 D3: a departure's places in a cart, priced on the server, through the order. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const bookings = () => getContainer().resolve<BookingModuleService>(BOOKING_MODULE)
    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const turnOn = async () => {
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
    }
    const post = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: store.headers }))
    const book = (cartId: string, body: unknown) => post(`/store/carts/${cartId}/bookings`, body)
    // A shopper's address as our storefront's server signs it (documentation range addresses)
    const bookFrom = (ip: string, cartId: string, body: unknown) =>
      settle(
        http.post<Answer>(`/store/carts/${cartId}/bookings`, body, {
          headers: { ...store.headers, ...signedAs(ip) },
        })
      )
    const startPayment = (cartId: string) =>
      post(`/store/carts/${cartId}/payment-session`, { provider_id: BANK_TRANSFER })
    const slotOf = async (slotId: string) => (await bookings().slotAvailability([slotId]))[0]

    /** A guest's empty cart, addressed; nothing in it ships. */
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

    /**
     * A published day tour: an adult at 1.500 TL, an infant at 100 TL who
     * takes no place, one departure in ten days with `capacity` places and
     * a 250,50 TL difference on the adult's price.
     */
    const tour = async (capacity: number, mode: "departure" | "none" = "departure") => {
      const { data } = await http.post<{
        product: { id: string; variants: { id: string; title: string }[] }
      }>(
        "/admin/products",
        {
          title: `Kapadokya turu ${String((made += 1))}`,
          status: "draft",
          options: [{ title: "Kişi", values: ["Yetişkin", "Bebek"] }],
          variants: [
            {
              title: "Yetişkin",
              options: { Kişi: "Yetişkin" },
              prices: [{ currency_code: "try", amount: 1500 }],
            },
            {
              title: "Bebek",
              options: { Kişi: "Bebek" },
              prices: [{ currency_code: "try", amount: 100 }],
            },
          ],
          sales_channels: [{ id: shop.salesChannelId }],
        },
        { headers: admin.headers }
      )
      const productId = data.product.id
      const variantOf = (title: string) =>
        data.product.variants.find((variant) => variant.title === title)?.id ?? ""
      const adult = variantOf("Yetişkin")
      const infant = variantOf("Bebek")
      await staff(`/admin/products/${productId}/catalog`, { kind: "service", booking_mode: mode })
      await staff(`/admin/products/${productId}`, { status: "published" })
      if (mode === "none") {
        // A service sold without stock: no location holds it, so stock is not tracked
        await staff(`/admin/products/${productId}`, {
          variants: [adult, infant].map((id) => ({ id, manage_inventory: false })),
        })
        return { productId, adult, infant, slotId: "" }
      }
      await staff(`/admin/products/${productId}/bookable`, {
        hold_minutes: 20,
        pax_by_variant: { [infant]: { pax: 0, max_age: 2 } },
      })
      const slots = await staff(`/admin/products/${productId}/booking-slots`, {
        slots: [
          {
            starts_at: new Date(Date.now() + 10 * DAY).toISOString(),
            capacity,
            price_adjustments: { [adult]: 250.5 },
          },
        ],
      })
      const slotId = ((slots.data["slots"] as { id: string }[] | undefined) ?? [])[0]?.id ?? ""
      return { productId, adult, infant, slotId }
    }

    beforeAll(() => {
      resetClientIpSecret()
    })

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
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("answers as missing while the flag is off, and the ordinary cart works as before (K11)", async () => {
      const container = getContainer()
      const product = await stockedProduct(container, shop, `kapali-tur-${String((made += 1))}`, 5)
      const cartId = await readyCart(container, shop, product.variantId)

      const add = await post(`/store/carts/${cartId}/bookings`, {
        slot_id: "bkslot_01ABC",
        items: [{ variant_id: product.variantId, quantity: 1 }],
      })
      const hold = await settle(
        http.get(`/store/carts/${cartId}/bookings`, { headers: store.headers })
      )
      const remove = await settle(
        http.delete(`/store/carts/${cartId}/bookings/bkslot_01ABC`, { headers: store.headers })
      )
      const read = await settle(
        http.get(`/store/products/${product.productId}/booking`, { headers: store.headers })
      )
      const more = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: product.variantId,
        quantity: 1,
      })
      const line = ((more.data["cart"] as { items: { id: string; quantity: number }[] } | undefined)
        ?.items ?? [])[0]
      const changed = await post(`/store/carts/${cartId}/line-items/${line?.id ?? ""}`, {
        quantity: 3,
      })
      const started = await startPayment(cartId)
      const placed = await post(`/store/carts/${cartId}/complete`, {})

      expect([add.status, remove.status, read.status, hold.status]).toEqual([404, 404, 404, 404])
      expect(line?.quantity).toBe(2)
      expect(changed.status).toBe(200)
      expect(started.status).toBe(200)
      expect(placed.status).toBe(200)
      expect(placed.data["type"]).toBe("order")
    })

    it("books only through its route, at the server's price, and keeps the places in step", async () => {
      await turnOn()
      const { productId, adult, infant, slotId } = await tour(10)
      const cartId = await emptyCart(getContainer())

      const plain = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: adult,
        quantity: 1,
      })
      const madeWith = await post("/store/carts", {
        region_id: shop.regionId,
        items: [{ variant_id: adult, quantity: 1 }],
      })
      const priced = await book(cartId, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 2, unit_price: 1 }],
      })
      const marked = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: adult,
        quantity: 1,
        metadata: { qt_booking: { slot_id: slotId } },
      })
      const infants = await book(cartId, {
        slot_id: slotId,
        items: [
          { variant_id: adult, quantity: 1 },
          { variant_id: infant, quantity: 3 },
        ],
      })
      const repeated = await book(cartId, {
        slot_id: slotId,
        items: [
          { variant_id: adult, quantity: 60 },
          { variant_id: adult, quantity: 41 },
        ],
      })
      const booked = await book(cartId, {
        slot_id: slotId,
        items: [
          { variant_id: adult, quantity: 2 },
          { variant_id: infant, quantity: 1 },
        ],
      })
      const answer = booked.data as unknown as BookingAnswer
      const afterBook = await slotOf(slotId)
      const adultLine = answer.lines.find((line) => line.variant_id === adult)
      const changed = await post(`/store/carts/${cartId}/line-items/${adultLine?.id ?? ""}`, {
        quantity: 3,
      })
      const page = await settle(
        http.get<{ booking: Record<string, unknown> }>(`/store/products/${productId}/booking`, {
          headers: store.headers,
        })
      )
      // A fifth of the ten places is one cart's most (adr/0076 Ek): no cart takes the departure
      const full = await book(cartId, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 11 }],
      })
      const again = await book(cartId, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 1 }],
      })
      const afterAgain = await slotOf(slotId)
      // Removed through Medusa's own line route: the places follow as the cart changes
      const lineId = (again.data as unknown as BookingAnswer).lines[0]?.id ?? ""
      const coreDelete = await settle(
        http.delete(`/store/carts/${cartId}/line-items/${lineId}`, { headers: store.headers })
      )
      const afterCoreDelete = await eventually(
        () => slotOf(slotId),
        (slot) => slot?.held === 0
      )
      await book(cartId, { slot_id: slotId, items: [{ variant_id: adult, quantity: 2 }] })
      const removed = await settle(
        http.delete<BookingAnswer>(`/store/carts/${cartId}/bookings/${slotId}`, {
          headers: store.headers,
        })
      )
      const afterRemove = await slotOf(slotId)

      expect([plain.status, plain.data.message]).toEqual([400, "booking.use_booking_route"])
      expect([madeWith.status, madeWith.data.message]).toEqual([400, "booking.use_booking_route"])
      expect(priced.status).toBe(400)
      expect([marked.status, marked.data.message]).toEqual([400, "cart.metadata_reserved"])
      // Two place-less units per place at most; a category's asks added up, 100 at most
      expect([infants.status, infants.data.message]).toEqual([400, "booking.too_many_free_units"])
      expect([repeated.status, repeated.data.message]).toEqual([400, "booking.quantity_too_high"])
      expect(booked.status).toBe(200)
      expect(answer.booking).toEqual({ slot_id: slotId, units: 2 })
      expect(answer.hold?.expires_at).toEqual(expect.any(String))
      // 1.500 + 250,50 for the adult; the infant at its own price, no place taken
      expect(adultLine).toMatchObject({ quantity: 2, unit_price: 1750.5, slot_id: slotId })
      expect(answer.lines.find((line) => line.variant_id === infant)).toMatchObject({
        quantity: 1,
        unit_price: 100,
      })
      expect(afterBook).toMatchObject({ held: 2, sold: 0, available: 8 })
      expect([changed.status, changed.data.message]).toEqual([400, "booking.use_booking_route"])
      expect(page.status).toBe(200)
      expect(page.data.booking).toMatchObject({
        categories: expect.arrayContaining([
          expect.objectContaining({ variant_id: adult, pax: 1 }),
          expect.objectContaining({ variant_id: infant, pax: 0, max_age: 2 }),
        ]) as unknown,
        slots: [
          expect.objectContaining({
            id: slotId,
            status: "open",
            available: 8,
            prices: expect.arrayContaining([{ variant_id: adult, amount: 1750.5 }]) as unknown,
          }),
        ],
      })
      expect([full.status, full.data.message]).toEqual([400, "booking.max_units"])
      expect(again.status).toBe(200)
      expect((again.data as unknown as BookingAnswer).lines).toHaveLength(1)
      expect(afterAgain).toMatchObject({ held: 1, available: 9 })
      expect(coreDelete.status).toBe(200)
      expect(afterCoreDelete).toMatchObject({ held: 0, available: 10 })
      expect(removed.status).toBe(200)
      expect(removed.data.lines).toEqual([])
      expect(afterRemove).toMatchObject({ held: 0, available: 10 })
    })

    it("gives the last place to one of two carts asking at once", async () => {
      await turnOn()
      const { adult, slotId } = await tour(1)
      const container = getContainer()
      const carts = [await emptyCart(container), await emptyCart(container)]

      // Two shoppers: one address's carts would be capped by its share first
      const answers = await Promise.all(
        carts.map((cartId, index) =>
          bookFrom(`198.51.100.${String(index + 1)}`, cartId, {
            slot_id: slotId,
            items: [{ variant_id: adult, quantity: 1 }],
          })
        )
      )

      expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409])
      expect(answers.find((answer) => answer.status === 409)?.data.message).toBe(
        "booking.slot_full"
      )
      expect(await slotOf(slotId)).toMatchObject({ held: 1, available: 0 })
    })

    it("caps one address's carts at the departure's share; another address books freely", async () => {
      await turnOn()
      const container = getContainer()
      const { adult, slotId } = await tour(50)
      // One after another: the guest's customer is made once, not raced
      const carts: string[] = []
      for (let i = 0; i < 5; i += 1) {
        carts.push(await emptyCart(container))
      }
      const ask = (quantity: number) => ({
        slot_id: slotId,
        items: [{ variant_id: adult, quantity }],
      })

      // A cart's share of 10 on a departure of 50; one address keeps three
      // carts' worth (families behind one network): 30, never a 31st place
      const shared = []
      for (const [cartId, quantity] of [
        [carts[0], 10],
        [carts[1], 10],
        [carts[2], 10],
        [carts[3], 1],
      ] as const) {
        shared.push(await bookFrom("203.0.113.7", cartId ?? "", ask(quantity)))
      }
      const otherAnswer = await bookFrom("192.0.2.44", carts[4] ?? "", ask(5))

      expect(shared.slice(0, 3).map((answer) => answer.status)).toEqual([200, 200, 200])
      expect([shared[3]?.status, shared[3]?.data.message]).toEqual([400, "booking.client_share"])
      expect(otherAnswer.status).toBe(200)
      expect(await slotOf(slotId)).toMatchObject({ held: 35, available: 15 })
    })

    it("tags no address when the storefront signs it as unknown; a direct client by its own", async () => {
      await turnOn()
      const container = getContainer()
      const knex = () => container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      const { adult, slotId } = await tour(10)
      const [signedCart, unknownCart, directCart] = [
        await emptyCart(container),
        await emptyCart(container),
        await emptyCart(container),
      ]
      const ask = { slot_id: slotId, items: [{ variant_id: adult, quantity: 1 }] }

      const signedAnswer = await bookFrom("203.0.113.8", signedCart, ask)
      // adr/0076 Ek D5: the storefront could not read the shopper's address and says so, signed
      const unknownAnswer = await bookFrom(CLIENT_IP_UNKNOWN, unknownCart, ask)
      const directAnswer = await book(directCart, ask)
      const hashes = await knex()("booking_hold")
        .whereIn("cart_id", [signedCart, unknownCart, directCart])
        .select("cart_id", "client_hash")
      const hashOf = (cartId: string) =>
        (hashes as { cart_id: string; client_hash: string | null }[]).find(
          (row) => row.cart_id === cartId
        )?.client_hash

      expect([signedAnswer.status, unknownAnswer.status, directAnswer.status]).toEqual([
        200, 200, 200,
      ])
      expect(hashOf(signedCart)).toEqual(expect.any(String))
      expect(hashOf(unknownCart)).toBeNull()
      expect(hashOf(directCart)).toEqual(expect.any(String))
      expect(hashOf(directCart)).not.toBe(hashOf(signedCart))
    })

    it("pushes the hold as the payment starts, sells the places with the order, frees them on cancel", async () => {
      await turnOn()
      const container = getContainer()
      const { adult, slotId } = await tour(10)
      const cartId = await emptyCart(container)
      const booked = await book(cartId, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 2 }],
      })
      const before = new Date((booked.data as unknown as BookingAnswer).hold?.expires_at ?? 0)

      const started = await startPayment(cartId)
      const hold = await bookings().cartHold(cartId)
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id: string } | undefined)?.id ?? ""
      const sold = await eventually(
        () => slotOf(slotId),
        (slot) => slot?.sold === 2
      )
      const [booking] = await bookings().listBookings({ order_id: orderId })
      // An edit leaves the departure's places alone (adr/0076 Ek, until D7)
      const datedLine = booking?.line_item_id ?? ""
      const edits = await Promise.all(
        [
          { items: [{ id: datedLine, quantity: 3 }] },
          { items: [{ id: datedLine, quantity: 0 }] },
          { add: [{ variant_id: adult, quantity: 1 }] },
        ].map((change) => staff(`/admin/orders/${orderId}/edit/preview`, change))
      )
      // The departure's bookings for the panel (D4): the order's number, no person's details
      const listed = await settle(
        http.get<Answer>(`/admin/booking-slots/${slotId}/bookings`, { headers: admin.headers })
      )
      const unknownSlot = await settle(
        http.get<Answer>("/admin/booking-slots/bkslot_nope/bookings", { headers: admin.headers })
      )
      await cancelOrderWorkflow(container).run({ input: { order_id: orderId } })
      const freed = await eventually(
        () => slotOf(slotId),
        (slot) => slot?.sold === 0
      )
      const [cancelled] = await bookings().listBookings({ order_id: orderId })

      expect(started.status).toBe(200)
      // 20 minutes on booking, at least 30 from the payment's start
      expect(hold?.expires_at.getTime()).toBeGreaterThan(before.getTime())
      expect(hold?.expires_at.getTime()).toBeGreaterThan(Date.now() + 25 * 60_000)
      expect(placed.status).toBe(200)
      expect(sold).toMatchObject({ sold: 2, held: 0, available: 8 })
      expect(booking).toMatchObject({
        order_id: orderId,
        status: "confirmed",
        line_item_id: expect.any(String) as unknown,
      })
      expect(await bookings().cartHold(cartId)).toBeNull()
      expect(edits.map((edit) => [edit.status, edit.data.message])).toEqual([
        [400, "booking.order_edit_unavailable"],
        [400, "booking.order_edit_unavailable"],
        [400, "booking.order_edit_unavailable"],
      ])
      expect(listed.status).toBe(200)
      expect(listed.data["bookings"]).toEqual([
        {
          id: booking?.id,
          order_id: orderId,
          display_id: expect.any(Number) as unknown,
          units: 2,
          status: "confirmed",
          created_at: expect.any(String) as unknown,
          // The tour asks for no travelers (D6)
          travelers: [],
        },
      ])
      expect(unknownSlot.status).toBe(404)
      expect(freed).toMatchObject({ sold: 0, held: 0, available: 10 })
      expect(cancelled?.status).toBe("cancelled")
    })

    it("reconciles a cancel the order event missed, and leaves a confirmed order alone", async () => {
      await turnOn()
      const container = getContainer()
      const knex = () => container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      const { adult, slotId } = await tour(10)
      const cartId = await emptyCart(container)
      await book(cartId, { slot_id: slotId, items: [{ variant_id: adult, quantity: 2 }] })
      await startPayment(cartId)
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id: string } | undefined)?.id ?? ""
      await eventually(
        () => slotOf(slotId),
        (slot) => slot?.sold === 2
      )
      // Old enough for the job to look at it; its booking is there
      await knex()("order")
        .where({ id: orderId })
        .update({ created_at: knex().raw("now() - interval '30 minutes'") })
      const untouched = await reconcileBookings(container)
      // Cancelled without its event (a lost delivery)
      await knex()("order")
        .where({ id: orderId })
        .update({ status: "canceled", canceled_at: knex().raw("now()") })
      const reconciled = await reconcileBookings(container)
      const [booking] = await bookings().listBookings({ order_id: orderId })

      expect(placed.status).toBe(200)
      const nothing = { confirmed: 0, existing: 0, none: 0, cancelled: 0, failed: 0, given_up: 0 }
      expect(untouched).toEqual(nothing)
      expect(reconciled).toEqual({ ...nothing, cancelled: 1 })
      expect(booking?.status).toBe("cancelled")
      expect(await slotOf(slotId)).toMatchObject({ sold: 0, available: 10 })
    })

    it("refuses a payment's start and the completion once the hold has ended", async () => {
      await turnOn()
      const container = getContainer()
      const knex = () => container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      const { adult, slotId } = await tour(5)
      const expire = (cartId: string) =>
        knex()("booking_hold")
          .where({ cart_id: cartId })
          .update({ expires_at: knex().raw("now() - interval '1 minute'") })
      const late = await emptyCart(container)
      const paying = await emptyCart(container)
      for (const cartId of [late, paying]) {
        await book(cartId, { slot_id: slotId, items: [{ variant_id: adult, quantity: 1 }] })
      }

      const read = (cartId: string) =>
        settle(
          http.get<BookingAnswer & { lines: { held: boolean }[] }>(
            `/store/carts/${cartId}/bookings`,
            { headers: store.headers }
          )
        )
      // The storefront's countdown reads the hold's end, and each line whether it is still held
      const live = await read(late)
      await expire(late)
      const gone = await read(late)
      const lateStart = await startPayment(late)
      const started = await startPayment(paying)
      await expire(paying)
      const completed = await post(`/store/carts/${paying}/complete`, {})

      expect(live.status).toBe(200)
      expect(live.data.hold?.expires_at).toEqual(expect.any(String))
      expect(live.data.lines).toEqual([expect.objectContaining({ slot_id: slotId, held: true })])
      expect(gone.data.hold).toBeNull()
      expect(gone.data.lines).toEqual([expect.objectContaining({ slot_id: slotId, held: false })])
      expect([lateStart.status, lateStart.data.message]).toEqual([409, "booking.hold_expired"])
      expect(started.status).toBe(200)
      expect(completed.status).toBe(409)
      expect(completed.data.message).toBe("booking.hold_expired")
      expect(await slotOf(slotId)).toMatchObject({ sold: 0 })
    })

    it("prices a dated line with tax in as the shop's ordinary lines, no tax added on top", async () => {
      await turnOn()
      const container = getContainer()
      const { adult, slotId } = await tour(10)
      const knife = await stockedProduct(container, shop, `kdv-${String((made += 1))}`, 5, 100)
      const cartId = await emptyCart(container)
      await post(`/store/carts/${cartId}/line-items`, { variant_id: knife.variantId, quantity: 1 })
      const booked = await book(cartId, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 2 }],
      })
      const read = await settle(
        http.get<{
          cart: {
            total: number
            items: { variant_id: string; is_tax_inclusive: boolean; unit_price: number }[]
          }
        }>(`/store/carts/${cartId}?fields=+items.is_tax_inclusive`, {
          headers: store.headers,
        })
      )
      const items = read.data.cart.items
      const plainLine = items.find((item) => item.variant_id === knife.variantId)
      const datedLine = items.find((item) => item.variant_id === adult)

      expect(booked.status).toBe(200)
      expect(plainLine?.is_tax_inclusive).toBe(true)
      expect(datedLine).toMatchObject({ unit_price: 1750.5, is_tax_inclusive: true })
      // 100 + 2 × 1.750,50, KDV inside: nothing added (no shipping method yet)
      expect(read.data.cart.total).toBe(3601)
    })

    it("takes the shipping method off once only dated lines are left, and the order goes through", async () => {
      await turnOn()
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { adult, slotId } = await tour(10)
      const knife = await stockedProduct(container, shop, `kargo-${String((made += 1))}`, 5, 100)
      const cartId = await emptyCart(container)
      const added = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: knife.variantId,
        quantity: 1,
      })
      const shipped = await post(`/store/carts/${cartId}/shipping-methods`, {
        option_id: shop.shippingOptionId,
      })
      await book(cartId, { slot_id: slotId, items: [{ variant_id: adult, quantity: 1 }] })
      const methodsOf = async () => {
        const { data } = await query.graph({
          entity: "cart",
          fields: ["shipping_methods.id"],
          filters: { id: cartId },
        })
        return ((data as { shipping_methods?: unknown[] | null }[])[0]?.shipping_methods ?? [])
          .length
      }
      const methodsBefore = await methodsOf()
      const knifeLine = (
        (added.data["cart"] as { items: { id: string; variant_id: string }[] } | undefined)
          ?.items ?? []
      ).find((item) => item.variant_id === knife.variantId)?.id
      const removed = await settle(
        http.delete<Answer>(`/store/carts/${cartId}/line-items/${knifeLine ?? ""}`, {
          headers: store.headers,
        })
      )
      // The cart's change takes the method off (`cart-unneeded-shipping`), after the answer
      const methodsAfter = await eventually(methodsOf, (count) => count === 0)
      const view = await settle(
        http.get<Answer>(`/store/carts/${cartId}/bookings`, { headers: store.headers })
      )
      const total = await settle(
        http.get<{ cart: { total: number; shipping_total: number } }>(`/store/carts/${cartId}`, {
          headers: store.headers,
        })
      )
      // A cart that is not there (or not this storefront's) is not found (security review D-2/D-3)
      const unknown = await settle(
        http.get<Answer>(`/store/carts/cart_01UNKNOWN/bookings`, { headers: store.headers })
      )
      const started = await startPayment(cartId)
      const placed = await post(`/store/carts/${cartId}/complete`, {})

      expect(unknown.status).toBe(404)
      expect(shipped.status).toBe(200)
      expect(methodsBefore).toBe(1)
      expect(removed.status).toBe(200)
      expect(methodsAfter).toBe(0)
      expect(view.data["shipping_method_stale"]).toBe(false)
      // 1.500 + 250,50 for the departure; no shipping left on the bill
      expect(total.data.cart).toMatchObject({ total: 1750.5, shipping_total: 0 })
      expect(started.status).toBe(200)
      expect(placed.status).toBe(200)
      expect(placed.data["order"]).toMatchObject({ total: 1750.5 })
    })

    it("refuses at the payment and the completion a variant put in before its product was dated", async () => {
      await turnOn()
      const container = getContainer()
      const { productId, adult } = await tour(10, "none")
      const cartId = await emptyCart(container)
      const added = await post(`/store/carts/${cartId}/line-items`, {
        variant_id: adult,
        quantity: 1,
      })
      const started = await startPayment(cartId)
      await staff(`/admin/products/${productId}/catalog`, {
        kind: "service",
        booking_mode: "departure",
      })

      const completed = await post(`/store/carts/${cartId}/complete`, {})
      const again = await startPayment(cartId)

      expect(added.status).toBe(200)
      expect(started.status).toBe(200)
      expect([completed.status, completed.data.message]).toEqual([400, "booking.use_booking_route"])
      expect([again.status, again.data.message]).toEqual([400, "booking.use_booking_route"])
    })

    it("refuses at the payment and the completion a line whose product went to request only", async () => {
      await turnOn()
      const { productId, adult, slotId } = await tour(10)
      await staff(`/admin/products/${productId}/bookable`, { sale_mode: "both" })
      const cartId = await emptyCart(getContainer())
      const booked = await book(cartId, {
        slot_id: slotId,
        items: [{ variant_id: adult, quantity: 1 }],
      })
      const started = await startPayment(cartId)
      await staff(`/admin/products/${productId}/bookable`, { sale_mode: "request" })

      const completed = await post(`/store/carts/${cartId}/complete`, {})
      const again = await startPayment(cartId)

      expect([booked.status, started.status]).toEqual([200, 200])
      expect([completed.status, completed.data.message]).toEqual([
        400,
        "booking.online_not_offered",
      ])
      expect([again.status, again.data.message]).toEqual([400, "booking.online_not_offered"])
    })
  },
})

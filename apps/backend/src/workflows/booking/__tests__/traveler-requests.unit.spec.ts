import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { BOOKING_MODULE } from "../../../modules/booking"
import {
  MOST_FOUND,
  customerBookingTravelers,
  eraseBookingTravelers,
  findBookingTravelers,
} from "../traveler-requests"

const NOW = new Date("2026-11-22T10:00:00Z")

const ROW = {
  id: "bktrv_1",
  slot_id: "bkslot_1",
  booking_id: "bkng_1",
  first_name: "Ayşe",
  last_name: "Yılmaz",
  birth_date: "1990-01-15",
  nationality: "TR",
  document_last4: "5678",
  created_at: new Date("2026-11-20T09:00:00Z"),
  purge_after: new Date("2027-06-10T09:00:00Z"),
}

function containerWith(rows: (typeof ROW)[]) {
  const booking = {
    listBookingTravelers: jest.fn(() => Promise.resolve(rows)),
    deleteBookingTravelers: jest.fn(() => Promise.resolve()),
    travelerDocumentHash: jest.fn((number: string) => `hash:${number}`),
    listBookingSlots: jest.fn(() =>
      Promise.resolve([
        { id: "bkslot_1", starts_at: new Date("2026-12-12T06:00:00Z"), bookable_id: "bkbl_1" },
      ])
    ),
    listBookings: jest.fn(() => Promise.resolve([{ id: "bkng_1", order_id: "order_1" }])),
    listBookables: jest.fn(() => Promise.resolve([{ id: "bkbl_1", product_id: "prod_1" }])),
  }
  const graph = jest.fn(({ entity }: { entity: string }) =>
    Promise.resolve({
      data:
        entity === "product"
          ? [{ id: "prod_1", title: "Kapadokya turu" }]
          : [{ id: "order_1", display_id: 1042 }],
    })
  )
  const cart = { listCarts: jest.fn(() => Promise.resolve([{ id: "cart_1" }, { id: "cart_2" }])) }
  const services: Record<string, unknown> = {
    [BOOKING_MODULE]: booking,
    [ContainerRegistrationKeys.QUERY]: { graph },
    [Modules.CART]: cart,
  }
  const container = { resolve: (key: string) => services[key] } as unknown as MedusaContainer
  return { container, booking, cart }
}

describe("a traveler's own KVKK request (adr/0076 Ek D6b)", () => {
  it("finds the rows by the whole name, the birth date and the number's hash; masked", async () => {
    const { container, booking } = containerWith([ROW])

    const found = await findBookingTravelers(
      container,
      {
        first_name: "  ayşe ",
        last_name: "Yılmaz",
        birth_date: "1990-01-15",
        document_no: "u 1234-5678",
      },
      NOW
    )

    expect(booking.travelerDocumentHash).toHaveBeenCalledWith("U12345678")
    expect(booking.listBookingTravelers).toHaveBeenCalledWith(
      {
        first_name: { $ilike: "ay_e" },
        last_name: { $ilike: "Y_lmaz" },
        birth_date: "1990-01-15",
        document_hash: "hash:U12345678",
      },
      expect.objectContaining({
        take: MOST_FOUND * 2,
        skip: 0,
        order: { created_at: "DESC", id: "DESC" },
      })
    )
    const select = (booking.listBookingTravelers.mock.calls[0] as unknown[])[1] as {
      select: string[]
    }
    expect(select.select).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/encrypted|hash/)])
    )
    expect(found).toEqual([
      {
        id: "bktrv_1",
        first_name: "Ayşe",
        last_name: "Yılmaz",
        birth_date: "1990-01-15",
        nationality: "TR",
        document_masked: "***5678",
        starts_at: "2026-12-12T06:00:00.000Z",
        product_title: "Kapadokya turu",
        order_id: "order_1",
        display_id: 1042,
        created_at: "2026-11-20T09:00:00.000Z",
        purge_after: "2027-06-10T09:00:00.000Z",
      },
    ])
  })

  it("matches a name's own % and _ as themselves, and asks nothing more when only the name is given", async () => {
    const { container, booking } = containerWith([])

    await findBookingTravelers(container, { first_name: "A_li", last_name: "100%" }, NOW)

    expect(booking.listBookingTravelers).toHaveBeenCalledWith(
      { first_name: { $ilike: "A\\_l_" }, last_name: { $ilike: "100\\%" } },
      expect.anything()
    )
    expect(booking.travelerDocumentHash).not.toHaveBeenCalled()
  })

  it.each([
    [{ first_name: "", last_name: "Kaya" }],
    [{ first_name: "Ali", last_name: "Kaya", birth_date: "1990-02-30" }],
    [{ first_name: "Ali", last_name: "Kaya", birth_date: "2030-01-01" }],
    [{ first_name: "Ali", last_name: "Kaya", document_no: "12" }],
  ])("refuses what is not a name, a day or a number: %o", async (query) => {
    const { container, booking } = containerWith([])

    await expect(findBookingTravelers(container, query, NOW)).rejects.toMatchObject({
      safeMessage: "booking.traveler_search_invalid",
    })
    expect(booking.listBookingTravelers).not.toHaveBeenCalled()
  })

  it("tells an unbooked cart's row apart: no order", async () => {
    const { container } = containerWith([{ ...ROW, booking_id: null as unknown as string }])

    const [found] = await findBookingTravelers(
      container,
      { first_name: "Ayşe", last_name: "yılmaz" },
      NOW
    )

    expect(found).toMatchObject({ order_id: null, display_id: null })
  })

  it("matches a name by Turkish case, the dotted and dotless i as one (review D2)", async () => {
    const { container, booking } = containerWith([
      { ...ROW, id: "bktrv_2", first_name: "İSMAİL", last_name: "IŞIK" },
      { ...ROW, id: "bktrv_3", first_name: "ismail", last_name: "işik" },
      { ...ROW, id: "bktrv_4", first_name: "Ismaıl", last_name: "ışık" },
      // Of the first cut's shape, another name
      { ...ROW, id: "bktrv_5", first_name: "asmail", last_name: "Işık" },
    ])

    const found = await findBookingTravelers(
      container,
      { first_name: "ismail", last_name: "Işık" },
      NOW
    )

    expect(booking.listBookingTravelers).toHaveBeenCalledWith(
      { first_name: { $ilike: "_sma_l" }, last_name: { $ilike: "___k" } },
      expect.anything()
    )
    expect(found.map((row) => row.id)).toEqual(["bktrv_2", "bktrv_3", "bktrv_4"])
  })

  it("reads the first cut on, page by page, and keeps at most MOST_FOUND", async () => {
    const page = (name: string) =>
      Array.from({ length: MOST_FOUND * 2 }, (_, at) => ({
        ...ROW,
        id: `bktrv_${name}_${String(at)}`,
        first_name: name,
      }))
    const { container, booking } = containerWith([])
    booking.listBookingTravelers
      .mockResolvedValueOnce(page("Asmail"))
      .mockResolvedValueOnce(page("İsmail"))

    const found = await findBookingTravelers(
      container,
      { first_name: "ismail", last_name: "Yılmaz" },
      NOW
    )

    expect(booking.listBookingTravelers).toHaveBeenCalledTimes(2)
    expect(booking.listBookingTravelers).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: MOST_FOUND * 2 })
    )
    expect(found).toHaveLength(MOST_FOUND)
    expect(found.every((row) => row.first_name === "İsmail")).toBe(true)
  })

  it("deletes for good only the rows that exist, and says how many", async () => {
    const { container, booking } = containerWith([ROW])

    const erased = await eraseBookingTravelers(container, ["bktrv_1", "bktrv_gone"])

    expect(erased).toEqual({ deleted: 1, booking_ids: ["bkng_1"], slot_ids: ["bkslot_1"] })
    expect(booking.listBookingTravelers).toHaveBeenCalledWith(
      { id: ["bktrv_1", "bktrv_gone"] },
      { select: ["id", "booking_id", "slot_id"] }
    )
    expect(booking.deleteBookingTravelers).toHaveBeenCalledWith(["bktrv_1"])
  })

  it("puts the travelers of a customer's carts in their copy, in Turkish, the number masked", async () => {
    const { container, booking, cart } = containerWith([ROW])

    const copy = await customerBookingTravelers(container, "cus_1")

    expect(cart.listCarts).toHaveBeenCalledWith({ customer_id: "cus_1" }, { select: ["id"] })
    expect(booking.listBookingTravelers).toHaveBeenCalledWith(
      { cart_id: ["cart_1", "cart_2"] },
      expect.anything()
    )
    expect(copy).toEqual([
      {
        ad: "Ayşe",
        soyad: "Yılmaz",
        doğum_tarihi: "1990-01-15",
        uyruk: "TR",
        kimlik_ya_da_pasaport_no: "***5678",
        ürün: "Kapadokya turu",
        hizmet_tarihi: "2026-12-12T06:00:00.000Z",
        sipariş: 1042,
        silinme_tarihi: "2027-06-10T09:00:00.000Z",
      },
    ])
  })

  it("reads no traveler for a customer without carts", async () => {
    const { container, booking, cart } = containerWith([ROW])
    cart.listCarts.mockResolvedValueOnce([])

    expect(await customerBookingTravelers(container, "cus_2")).toEqual([])
    expect(booking.listBookingTravelers).not.toHaveBeenCalled()
  })
})

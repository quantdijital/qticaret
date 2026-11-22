import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const next = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: next.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: next.redirect }))
const store = vi.hoisted(() => ({
  cartTravelers: vi.fn(),
  saveCartTravelers: vi.fn(),
}))
vi.mock("@/lib/booking/travelers", () => store)
const carts = vi.hoisted(() => ({ checkoutCart: vi.fn() }))
vi.mock("@/lib/checkout/cart", () => carts)

const { saveTravelers } = await import("../travelers")
const { parseTravelers } = await import("@/lib/checkout/traveler-form")

const TOUR = "bkslot_01K0000000000000000000TOUR"
const BOAT = "bkslot_01K0000000000000000000BOAT"
const NOW = new Date("2026-11-22T12:00:00Z")

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value)
  }
  return data
}

const person = (n: number, slot: string, extra: Record<string, string> = {}) => ({
  [`traveler.${String(n)}.slot_id`]: slot,
  [`traveler.${String(n)}.first_name`]: " Ayşe  Nur ",
  [`traveler.${String(n)}.last_name`]: "Yılmaz",
  ...extra,
})

const LEVELS = new Map([
  [TOUR, "name" as const],
  [BOAT, "nationality" as const],
])

const submit = (fields: Record<string, string>) =>
  saveTravelers({ ok: false, error: null }, form(fields))

beforeEach(() => {
  vi.clearAllMocks()
  carts.checkoutCart.mockResolvedValue({ id: "cart_1" })
  store.cartTravelers.mockResolvedValue({
    needs: [
      { slot_id: TOUR, level: "name", count: 1, starts_at: null },
      { slot_id: BOAT, level: "nationality", count: 1, starts_at: null },
    ],
    travelers: [],
    complete: false,
  })
  store.saveCartTravelers.mockResolvedValue(undefined)
})

describe("the travelers form, read", () => {
  it("cleans each field as the backend keeps it and sends only what the level asks", () => {
    const parsed = parseTravelers(
      form({
        ...person(1, BOAT, {
          "traveler.1.birth_date": "1990-05-04",
          "traveler.1.document_no": "a12 345-678",
          "traveler.1.nationality": "de",
        }),
        // A field the tour does not ask is dropped, not sent
        ...person(0, TOUR, { "traveler.0.birth_date": "1990-05-04" }),
      }),
      LEVELS,
      NOW
    )
    expect(parsed).toEqual({
      ok: true,
      travelers: [
        { slot_id: TOUR, first_name: "Ayşe Nur", last_name: "Yılmaz" },
        {
          slot_id: BOAT,
          first_name: "Ayşe Nur",
          last_name: "Yılmaz",
          birth_date: "1990-05-04",
          document_no: "A12345678",
          nationality: "DE",
        },
      ],
    })
  })

  it("names the field of each mistake, a missing select's too", () => {
    const boat = (extra: Record<string, string>) =>
      parseTravelers(
        form(
          person(0, BOAT, {
            "traveler.0.birth_date": "1990-05-04",
            "traveler.0.document_no": "12345678901",
            "traveler.0.nationality": "TR",
            ...extra,
          })
        ),
        LEVELS,
        NOW
      )
    expect(boat({ "traveler.0.first_name": "  " })).toEqual({
      ok: false,
      error: "checkout.traveler_name_required",
      field: "traveler.0.first_name",
    })
    expect(boat({ "traveler.0.last_name": "x".repeat(101) })).toMatchObject({
      field: "traveler.0.last_name",
    })
    for (const date of ["1990-02-30", "2026-11-23", "1890-01-01", "04.05.1990", ""]) {
      expect(boat({ "traveler.0.birth_date": date })).toMatchObject({
        error: "checkout.traveler_birth_date_invalid",
        field: "traveler.0.birth_date",
      })
    }
    for (const number of ["1234", "A".repeat(21), "12345/678", ""]) {
      expect(boat({ "traveler.0.document_no": number })).toMatchObject({
        error: "checkout.traveler_document_invalid",
        field: "traveler.0.document_no",
      })
    }
    // A select left on its disabled prompt sends no field at all
    const data = form(person(0, BOAT, { "traveler.0.birth_date": "1990-05-04" }))
    data.set("traveler.0.document_no", "12345678901")
    expect(parseTravelers(data, LEVELS, NOW)).toMatchObject({
      error: "checkout.traveler_nationality_required",
      field: "traveler.0.nationality",
    })
  })

  it("refuses a departure not asked, a field not ours and an empty form", () => {
    const other = "bkslot_01K000000000000000000OTHER"
    expect(parseTravelers(form(person(0, other)), LEVELS, NOW)).toMatchObject({
      error: "checkout.travelers_failed",
      field: null,
    })
    expect(
      parseTravelers(form({ ...person(0, TOUR), "traveler.0.price": "1" }), LEVELS, NOW)
    ).toMatchObject({ error: "checkout.travelers_failed" })
    expect(parseTravelers(form({}), LEVELS, NOW)).toMatchObject({
      error: "checkout.travelers_failed",
    })
  })

  it("takes the fields in the form as asked when the levels could not be read", () => {
    expect(
      parseTravelers(form(person(0, TOUR, { "traveler.0.nationality": "tr" })), null, NOW)
    ).toEqual({
      ok: true,
      travelers: [
        { slot_id: TOUR, first_name: "Ayşe Nur", last_name: "Yılmaz", nationality: "TR" },
      ],
    })
  })
})

describe("the travelers step's action", () => {
  it("saves the travelers on the shopper's cart and opens the next step", async () => {
    await expect(submit(person(0, TOUR))).rejects.toThrow("redirect:/odeme")
    expect(store.saveCartTravelers).toHaveBeenCalledWith("cart_1", [
      { slot_id: TOUR, first_name: "Ayşe Nur", last_name: "Yılmaz" },
    ])
    expect(next.revalidatePath).toHaveBeenCalledWith("/odeme")
  })

  it("answers a mistake with its field, sending nothing", async () => {
    const result = await submit(person(0, TOUR, { "traveler.0.first_name": "" }))
    expect(result).toEqual({
      ok: false,
      error: "checkout.traveler_name_required",
      field: "traveler.0.first_name",
    })
    expect(store.saveCartTravelers).not.toHaveBeenCalled()
  })

  it("says the backend's refusal in the shopper's words, a down backend not as the payment's", async () => {
    store.saveCartTravelers.mockRejectedValueOnce(
      new StoreApiError(400, "booking.travelers_invalid", null)
    )
    expect(await submit(person(0, TOUR))).toEqual({
      ok: false,
      error: "booking.travelers_invalid",
      field: null,
    })
    store.saveCartTravelers.mockRejectedValueOnce(new StoreApiError(503, null, null))
    expect(await submit(person(0, TOUR))).toMatchObject({ error: "checkout.travelers_failed" })
    store.saveCartTravelers.mockRejectedValueOnce(new StoreApiError(429, null, null))
    expect(await submit(person(0, TOUR))).toMatchObject({ error: "errors.too_many_requests" })
  })

  it("sends a shopper without a cart back to it", async () => {
    carts.checkoutCart.mockResolvedValueOnce(null)
    await expect(submit(person(0, TOUR))).rejects.toThrow("redirect:/sepet")
    expect(store.saveCartTravelers).not.toHaveBeenCalled()
  })
})

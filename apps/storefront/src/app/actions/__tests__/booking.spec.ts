import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const next = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: next.revalidatePath }))
const store = vi.hoisted(() => ({ bookIntoCart: vi.fn() }))
vi.mock("@/lib/booking/store", () => store)

const { addBookingToCart } = await import("../booking")
const { BOOKING_ERROR_KEYS } = await import("@/lib/booking/errors")

const SLOT = "bkslot_01K0000000000000000000000"
const ADULT = "variant_01K00000000000000000ADULT"
const CHILD = "variant_01K00000000000000000CHILD"

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    data.set(name, value)
  }
  return data
}

const add = (fields: Record<string, string>) =>
  addBookingToCart({ ok: false, error: null }, form(fields))

class BookingRefused extends Error {
  override readonly name = "BookingRefused"
  constructor(readonly key: string) {
    super(key)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  store.bookIntoCart.mockResolvedValue(undefined)
})

describe("a departure into the cart", () => {
  it("sends only the departure and the counts, no price, and refreshes the frame", async () => {
    const result = await add({
      slot_id: SLOT,
      [`qty_${ADULT}`]: "2",
      [`qty_${CHILD}`]: "0",
      price: "1",
      total: "1",
    })
    expect(result).toEqual({ ok: true, error: null })
    expect(store.bookIntoCart).toHaveBeenCalledWith(SLOT, [{ variant_id: ADULT, quantity: 2 }])
    expect(next.revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it("asks for a departure, then for people", async () => {
    expect(await add({ [`qty_${ADULT}`]: "1" })).toEqual({
      ok: false,
      error: "booking.choose_departure",
    })
    expect(await add({ slot_id: "slot_1", [`qty_${ADULT}`]: "1" })).toMatchObject({
      error: "booking.choose_departure",
    })
    expect(await add({ slot_id: SLOT, [`qty_${ADULT}`]: "" })).toMatchObject({
      error: "booking.choose_people",
    })
    expect(store.bookIntoCart).not.toHaveBeenCalled()
  })

  it("refuses a malformed count or variant without asking the backend", async () => {
    for (const fields of [
      { slot_id: SLOT, [`qty_${ADULT}`]: "1.5" },
      { slot_id: SLOT, [`qty_${ADULT}`]: "101" },
      { slot_id: SLOT, [`qty_${ADULT}`]: "-1" },
      { slot_id: SLOT, qty_prod_1: "1" },
    ]) {
      expect(await add(fields)).toMatchObject({ error: "booking.add_failed" })
    }
    expect(store.bookIntoCart).not.toHaveBeenCalled()
  })

  it("passes a refusal the shopper can act on as it comes", async () => {
    store.bookIntoCart.mockRejectedValueOnce(new StoreApiError(409, "booking.slot_full", null))
    expect(await add({ slot_id: SLOT, [`qty_${ADULT}`]: "1" })).toEqual({
      ok: false,
      error: "booking.slot_full",
    })
    expect(next.revalidatePath).not.toHaveBeenCalled()
  })

  it("says too many asks for a 429 and the fallback for an unknown key", async () => {
    store.bookIntoCart.mockRejectedValueOnce(new StoreApiError(429, null, null))
    expect(await add({ slot_id: SLOT, [`qty_${ADULT}`]: "1" })).toMatchObject({
      error: "errors.too_many_requests",
    })
    store.bookIntoCart.mockRejectedValueOnce(new StoreApiError(400, "booking.internal_x", null))
    expect(await add({ slot_id: SLOT, [`qty_${ADULT}`]: "1" })).toMatchObject({
      error: "booking.add_failed",
    })
    store.bookIntoCart.mockRejectedValueOnce(new Error("network"))
    expect(await add({ slot_id: SLOT, [`qty_${ADULT}`]: "1" })).toMatchObject({
      error: "booking.add_failed",
    })
  })

  it("says dated sales are not taken now when the shop turned them off", async () => {
    store.bookIntoCart.mockRejectedValueOnce(new BookingRefused("catalog.booking_disabled"))
    expect(await add({ slot_id: SLOT, [`qty_${ADULT}`]: "1" })).toMatchObject({
      error: "booking.unavailable",
    })
    store.bookIntoCart.mockRejectedValueOnce(new StoreApiError(404, null, null))
    expect(await add({ slot_id: SLOT, [`qty_${ADULT}`]: "1" })).toMatchObject({
      error: "booking.unavailable",
    })
  })

  it("has words for every refusal it passes through", async () => {
    const { t } = await import("@/lib/i18n")
    for (const key of [...BOOKING_ERROR_KEYS, "booking.unavailable", "booking.add_failed"]) {
      expect(t(key)).not.toBe(key)
    }
  })
})

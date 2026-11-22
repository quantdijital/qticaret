import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const store = vi.hoisted(() => ({ storeCall: vi.fn(), storeGet: vi.fn(), storePost: vi.fn() }))
vi.mock("@/lib/store-api/server", () => store)

const { requestBooking } = await import("../booking-request")

const INITIAL = { ok: false, error: null, challenge: null }
const PRODUCT = "prod_01JABCDEFGHJKMNPQ"
const SLOT = "bkslot_01JABCDEFGHJKMNPQ"

const BASE = {
  product_id: PRODUCT,
  name: "Ayşe Yılmaz",
  phone: "0532 123 45 67",
  email: "",
  when: "flexible",
  adults: "2",
  children: "",
  note: "",
  consent: "1",
}

// The body the backend was sent on the nth call
const bodyOf = (call: number) =>
  (store.storeCall.mock.calls[call]?.[1] as { body: Record<string, unknown> } | undefined)?.body

const send = (fields: Record<string, string>) => {
  const form = new FormData()
  for (const [name, value] of Object.entries({ ...BASE, ...fields })) {
    form.set(name, value)
  }
  return requestBooking(INITIAL, form)
}

/** A dated product's "call me" request (adr/0076 Ek 2026-11-23). */
describe("requestBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.storeCall.mockResolvedValue({ status: "received" })
  })

  it("sends open dates with a phone only, no price, no address", async () => {
    await expect(send({})).resolves.toEqual({ ok: true, error: null, challenge: null })
    expect(store.storeCall).toHaveBeenCalledWith("/store/booking-requests", {
      method: "POST",
      body: {
        product_id: PRODUCT,
        name: "Ayşe Yılmaz",
        phone: "0532 123 45 67",
        adults: 2,
        consent: true,
      },
    })
  })

  it("sends the one of departure, day or month the shopper chose", async () => {
    await send({ when: SLOT, children: "1", email: "Ayse@Example.com", note: "Akşam arayın" })
    expect(store.storeCall.mock.calls[0]?.[1]).toMatchObject({
      body: {
        slot_id: SLOT,
        children: 1,
        email: "ayse@example.com",
        note: "Akşam arayın",
      },
    })
    await send({ when: "month", month: "2027-03", date: "2027-03-04" })
    expect(bodyOf(1)).toMatchObject({ month: "2027-03" })
    expect(bodyOf(1)).not.toHaveProperty("date")
    await send({ when: "date", date: "2027-03-04" })
    expect(bodyOf(2)).toMatchObject({ date: "2027-03-04" })
  })

  it.each([
    ["no consent", { consent: "" }, "booking_request.consent_required"],
    ["no phone", { phone: "" }, "booking_request.phone_invalid"],
    ["a bad address", { email: "ayse" }, "booking_request.email_invalid"],
    ["a day chosen but not given", { when: "date" }, "booking_request.when_invalid"],
    ["a departure that is not one", { when: "yarın" }, "booking_request.when_invalid"],
    ["no adult", { adults: "0" }, "booking_request.invalid"],
  ])("refuses %s and never calls the backend", async (_name, fields, error) => {
    await expect(send(fields)).resolves.toEqual({ ok: false, error, challenge: null })
    expect(store.storeCall).not.toHaveBeenCalled()
  })

  it("passes a proof of work asked for back to the form, then sends it", async () => {
    const challenge = { token: "t", salt: "s", bits: 12 }
    store.storeCall.mockRejectedValueOnce(new StoreApiError(428, null, null, { challenge }))
    await expect(send({})).resolves.toEqual({ ok: false, error: null, challenge })
    await send({ challenge: "solved.1" })
    expect(store.storeCall.mock.calls[1]?.[1]).toMatchObject({
      headers: { "x-challenge": "solved.1" },
    })
  })

  it.each([
    [429, null, "booking_request.rate_limited"],
    [400, "booking.request_slot_invalid", "booking_request.when_invalid"],
    [400, "booking.request_people_invalid", "booking_request.people_invalid"],
    [400, "booking.request_not_offered", "booking_request.invalid"],
    [500, null, "booking_request.failed"],
  ])("words a %s %s from the backend", async (status, key, error) => {
    store.storeCall.mockRejectedValueOnce(new StoreApiError(status, key, null))
    await expect(send({})).resolves.toEqual({ ok: false, error, challenge: null })
  })
})

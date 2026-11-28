import { BulkChange } from "../change"
import { planBulkChange } from "../plan"
import type { BulkPlan, PlanContext } from "../plan"
import { endsBooking } from "../plan-kind"
import type { BulkProduct } from "../products"

const ON: PlanContext = { locationId: null, features: { nonPhysical: true, booking: true } }
const OFF: PlanContext = { locationId: null, features: { nonPhysical: false, booking: false } }

const product = (extension: BulkProduct["product_extension"] = null): BulkProduct => ({
  id: "prod_1",
  handle: "tur",
  title: "Tur",
  status: "published",
  product_extension: extension,
})

const change = (input: Record<string, unknown>) =>
  BulkChange.parse({ action: "kind", ...input }) as Extract<BulkChange, { action: "kind" }>
const plan = (row: BulkProduct, input: Record<string, unknown>, context = ON): BulkPlan =>
  planBulkChange(row, change(input), context)

describe("bulk edit: kind", () => {
  it("takes a kind, with a booking mode only for a service", () => {
    expect(change({ kind: "digital" })).toMatchObject({ booking_mode: "none" })
    expect(change({ kind: "service", booking_mode: "departure" }).booking_mode).toBe("departure")
    expect(() => change({ kind: "physical", booking_mode: "departure" })).toThrow()
    expect(() => change({ kind: "rental" })).toThrow()
    expect(() => change({ kind: "service", booking_mode: "hourly" })).toThrow()
  })

  it("writes the kind and the mode that change, with each before and after", () => {
    expect(plan(product(), { kind: "service", booking_mode: "departure" })).toEqual({
      kind: "write",
      write: { action: "kind", kind: "service", booking_mode: "departure" },
      diff: {
        kind: { before: "physical", after: "service" },
        booking_mode: { before: "none", after: "departure" },
      },
    })
    expect(plan(product({ kind: "service", booking_mode: "none" }), { kind: "digital" })).toEqual({
      kind: "write",
      write: { action: "kind", kind: "digital", booking_mode: "none" },
      diff: { kind: { before: "service", after: "digital" } },
    })
  })

  it("leaves a product of that kind and mode as it is", () => {
    expect(plan(product(), { kind: "physical" })).toEqual({ kind: "unchanged" })
    expect(
      plan(product({ kind: "service", booking_mode: "departure" }), {
        kind: "service",
        booking_mode: "departure",
      })
    ).toEqual({ kind: "unchanged" })
  })

  it("keeps a gift card digital", () => {
    const gift = product({ kind: "digital", is_gift_card: true })
    expect(plan(gift, { kind: "physical" })).toEqual({
      kind: "skipped",
      key: "catalog.gift_card_kind",
    })
    expect(plan(gift, { kind: "digital" }, OFF)).toEqual({ kind: "unchanged" })
  })

  it("needs the flags to make a product digital, a service or dated", () => {
    expect(plan(product(), { kind: "digital" }, OFF)).toEqual({
      kind: "skipped",
      key: "catalog.kind_disabled",
    })
    // Back to physical, or a kind it already has, needs no flag
    expect(plan(product({ kind: "digital" }), { kind: "physical" }, OFF).kind).toBe("write")
    expect(
      plan(product({ kind: "service", booking_mode: "departure" }), { kind: "service" }, OFF).kind
    ).toBe("write")
    const noBooking: PlanContext = {
      locationId: null,
      features: { nonPhysical: true, booking: false },
    }
    expect(plan(product(), { kind: "service", booking_mode: "departure" }, noBooking)).toEqual({
      kind: "skipped",
      key: "catalog.booking_disabled",
    })
  })

  it("takes a dated product off dated sale when it leaves service, and says so", () => {
    const dated = product({ kind: "service", booking_mode: "departure" })
    const leaving = plan(dated, { kind: "physical" })
    expect(leaving).toMatchObject({
      write: { kind: "physical", booking_mode: "none" },
      diff: { booking_mode: { before: "departure", after: "none" } },
    })
    expect(endsBooking(leaving)).toBe(true)
    expect(endsBooking(plan(dated, { kind: "service", booking_mode: "none" }))).toBe(true)
    expect(endsBooking(plan(product(), { kind: "service", booking_mode: "departure" }))).toBe(false)
    expect(endsBooking(plan(product({ kind: "service" }), { kind: "digital" }))).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { orderProgress, paymentWordsOf } from "../order-progress"

/**
 * An order's steps and the way it is paid (adr/0046 Ek 2026-11-05), from
 * the backend's statuses and the parcels that left.
 */

describe("an order's steps", () => {
  const when = (date: Date) => date.toISOString().slice(0, 10)
  const order = {
    status: "pending",
    payment_status: "captured",
    fulfillment_status: "not_fulfilled",
    created_at: "2026-11-05T11:06:00Z",
  }

  it("stands at packing once the card is paid", () => {
    const steps = orderProgress(order, [], { cashOnDelivery: false }, t, when) ?? []
    expect(steps.map(({ key, state }) => `${key}:${state}`)).toEqual([
      "placed:done",
      "paid:done",
      "packed:current",
      "shipped:ahead",
      "delivered:ahead",
    ])
    expect(steps[0]?.at).toBe("2026-11-05")
  })

  it("waits for a transfer's money in the payment step's own words", () => {
    const steps =
      orderProgress(
        { ...order, payment_status: "not_paid" },
        [],
        { cashOnDelivery: false },
        t,
        when
      ) ?? []
    expect(steps[1]).toMatchObject({ key: "paid", state: "current", label: "Ödeme bekleniyor" })
  })

  it("skips the payment for cash on delivery and follows the parcels", () => {
    const steps =
      orderProgress(
        { ...order, payment_status: "not_paid" },
        [{ shipped_at: "2026-11-06T09:00:00Z", delivered_at: null }],
        { cashOnDelivery: true },
        t,
        when
      ) ?? []
    expect(steps.map(({ key, state }) => `${key}:${state}`)).toEqual([
      "placed:done",
      "packed:done",
      "shipped:done",
      "delivered:current",
    ])
    expect(steps[2]?.at).toBe("2026-11-06")
  })

  it("is done when every parcel arrived, and has no steps once cancelled", () => {
    const steps =
      orderProgress(
        order,
        [{ shipped_at: "2026-11-06T09:00:00Z", delivered_at: "2026-11-07T09:00:00Z" }],
        { cashOnDelivery: false },
        t,
        when
      ) ?? []
    expect(steps.every((step) => step.state === "done")).toBe(true)
    expect(
      orderProgress({ ...order, status: "canceled" }, [], { cashOnDelivery: false }, t, when)
    ).toBeNull()
  })

  it("names the way it is paid", () => {
    expect(paymentWordsOf(["pp_paytr_paytr"], t)).toBe("Kredi / banka kartı")
    expect(paymentWordsOf(["pp_paytr_paytr", "pp_bank-transfer_bank-transfer"], t)).toBe(
      "Havale / EFT"
    )
    expect(paymentWordsOf(["pp_cod_cod"], t)).toBe("Kapıda ödeme")
    expect(paymentWordsOf([], t)).toBeNull()
  })
})

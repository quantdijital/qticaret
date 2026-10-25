import type { OpenOrder } from "../summarize"
import { awaitingShipment, salesByCurrency, startOfTurkishDay } from "../summarize"

const order = (
  payment: { status: string; amount: number; captured_amount?: number } | null,
  fulfillments: { canceled_at?: string | null }[] = []
): OpenOrder =>
  ({
    currency_code: "try",
    payment_collections: payment ? [{ refunded_amount: 0, captured_amount: 0, ...payment }] : [],
    fulfillments,
  }) as unknown as OpenOrder

describe("awaitingShipment", () => {
  it("counts paid or authorized orders that have no live shipment", () => {
    expect(
      awaitingShipment([
        order({ status: "captured", amount: 100, captured_amount: 100 }),
        order({ status: "authorized", amount: 100 }),
        // Every shipment canceled: it waits again
        order({ status: "captured", amount: 100, captured_amount: 100 }, [
          { canceled_at: "2026-10-25T10:00:00Z" },
        ]),
      ])
    ).toBe(3)
  })

  it("leaves out unpaid orders and those already being shipped", () => {
    expect(
      awaitingShipment([
        order({ status: "not_paid", amount: 100 }),
        order(null),
        order({ status: "captured", amount: 100, captured_amount: 100 }, [{ canceled_at: null }]),
      ])
    ).toBe(0)
  })
})

describe("salesByCurrency", () => {
  it("sums each currency in kuruş, without float drift", () => {
    expect(
      salesByCurrency([
        { currency_code: "try", total: 0.1 },
        { currency_code: "try", total: 0.2 },
        { currency_code: "eur", total: 10 },
        { currency_code: "try", total: "1250.5" },
      ])
    ).toEqual([
      { currency_code: "eur", amount: "10.00" },
      { currency_code: "try", amount: "1250.80" },
    ])
  })

  it("is empty on a day without sales", () => {
    expect(salesByCurrency([])).toEqual([])
  })
})

describe("startOfTurkishDay", () => {
  it("starts the day at midnight in Turkey, not UTC", () => {
    // 01:30 in Istanbul on the 26th is still the 25th in UTC
    expect(startOfTurkishDay(new Date("2026-10-25T22:30:00Z")).toISOString()).toBe(
      "2026-10-25T21:00:00.000Z"
    )
    expect(startOfTurkishDay(new Date("2026-10-25T20:59:00Z")).toISOString()).toBe(
      "2026-10-24T21:00:00.000Z"
    )
  })
})

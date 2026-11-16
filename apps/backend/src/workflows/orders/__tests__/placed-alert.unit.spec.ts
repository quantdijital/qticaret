import { alertPlacedOrder, placedAlertKey, placedAlertOf } from "../placed-alert"

describe("placedAlertOf: one alert per placed order", () => {
  it.each([
    // wholesale, bank transfer, payment link → the alert
    [false, false, false, "new_order"],
    [false, true, false, "bank_transfer_pending"],
    [true, false, false, "wholesale_order"],
    // A wholesaler's transfer: the wholesale alert says the money is awaited
    [true, true, false, "wholesale_order"],
    // The link rings its own "paid"; a transfer through it is still awaited
    [false, false, true, null],
    [true, false, true, null],
    [false, true, true, "bank_transfer_pending"],
  ] as const)(
    "wholesale %s, transfer %s, link %s → %s",
    (wholesale, bankTransfer, paymentLink, expected) => {
      expect(placedAlertOf({ wholesale, bankTransfer, paymentLink })).toBe(expected)
    }
  )
})

describe("alertPlacedOrder: one key per order, whatever the kind", () => {
  // Two runs at once both find no alert yet (the race): both write under the same key,
  // which the notification module keeps unique, so only one row can be written
  function containerFor() {
    const written: { idempotency_key: string; trigger_type: string }[] = []
    const container = {
      resolve: (key: string) =>
        key === "query"
          ? {
              graph: () =>
                Promise.resolve({
                  data: [{ id: "order_1", display_id: 7, total: 1000, currency_code: "try" }],
                }),
            }
          : {
              listNotifications: () => Promise.resolve([]),
              createNotifications: (row: { idempotency_key: string; trigger_type: string }) => {
                written.push(row)
                return Promise.resolve(row)
              },
            },
    }
    return { container, written }
  }

  it("writes a retail and a wholesale alert of one order under one key", async () => {
    const { container, written } = containerFor()
    await Promise.all([
      alertPlacedOrder(container as never, "order_1", null),
      alertPlacedOrder(container as never, "order_1", "wacc_1"),
    ])
    expect(written.map((row) => row.trigger_type).sort()).toEqual([
      "orders.new_order",
      "wholesale.order_placed",
    ])
    expect(new Set(written.map((row) => row.idempotency_key))).toEqual(
      new Set([placedAlertKey("order_1")])
    )
  })
})

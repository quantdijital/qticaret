import { invoiceLines, invoiceTotals } from ".."
import { exchangeLines, exchangeOfLine, exchangeSaleOrder, firstSaleOrder } from "../exchanges"
import type { ExchangedOrder } from "../exchanges"

const vat20 = [{ rate: 20 }]

// A pan bought in 20 cm, swapped for 24 cm; a canceled swap added nothing
const order = (changes: Partial<ExchangedOrder> = {}): ExchangedOrder => ({
  id: "order_1",
  created_at: "2026-10-30T21:30:00.000Z",
  currency_code: "try",
  items: [
    {
      id: "line_first",
      product_title: "Döküm tava",
      variant_title: "20 cm",
      quantity: 1,
      subtotal: 100,
      discount_subtotal: 0,
      tax_total: 20,
      total: 120,
      tax_lines: vat20,
    },
    {
      id: "line_swap",
      product_title: "Döküm tava",
      variant_title: "24 cm",
      quantity: 1,
      subtotal: 125,
      discount_subtotal: 0,
      tax_total: 25,
      total: 150,
      tax_lines: vat20,
    },
  ],
  shipping_methods: [
    {
      name: "Aras Kargo",
      subtotal: 50,
      discount_subtotal: 0,
      tax_total: 10,
      total: 60,
      tax_lines: vat20,
    },
    {
      name: "Aras Kargo",
      subtotal: 0,
      discount_subtotal: 0,
      tax_total: 0,
      total: 0,
      tax_lines: vat20,
    },
  ],
  exchanges: [
    { id: "exc_1", canceled_at: null, additional_items: [{ item_id: "line_swap", quantity: 1 }] },
    {
      id: "exc_old",
      canceled_at: "2026-10-31",
      additional_items: [{ item_id: "line_x", quantity: 1 }],
    },
  ],
  ...changes,
})

describe("an exchange's two documents (the accountant, 2026-10-31, 5.4)", () => {
  it("reads the lines each standing exchange added", () => {
    expect([...exchangeLines(order())]).toEqual([
      ["exc_1", [{ line_item_id: "line_swap", quantity: 1 }]],
    ])
    expect(exchangeOfLine(order(), "line_swap")).toBe("exc_1")
    expect(exchangeOfLine(order(), "line_first")).toBeNull()
    // A canceled exchange's line is the first sale's
    expect(exchangeOfLine(order(), "line_x")).toBeNull()
  })

  it("leaves the exchange's new line out of the first sale, with its shipping", () => {
    const lines = invoiceLines(firstSaleOrder(order()))

    expect(lines.map((line) => line.description)).toEqual([
      "Döküm tava - 20 cm",
      "Kargo bedeli - Aras Kargo",
    ])
    expect(invoiceTotals(lines).gross).toBe("180.00")
  })

  it("sells only the new line on the exchange's own invoice, without shipping", () => {
    const lines = invoiceLines(exchangeSaleOrder(order(), "exc_1"))

    expect(lines.map((line) => line.description)).toEqual(["Döküm tava - 24 cm"])
    expect(invoiceTotals(lines)).toEqual({ net: "125.00", vat: "25.00", gross: "150.00" })
  })

  it("keeps an order without exchanges as it is", () => {
    const plain = order({ exchanges: [] })

    expect(firstSaleOrder(plain)).toBe(plain)
    expect(invoiceLines(exchangeSaleOrder(plain, "exc_1"))).toEqual([])
  })
})

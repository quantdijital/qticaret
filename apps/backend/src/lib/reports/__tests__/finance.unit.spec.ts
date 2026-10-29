import { collections, methodOf, vatBreakdown } from "../finance"
import type { FinanceOrder } from "../finance"

const ORDERS: FinanceOrder[] = [
  {
    id: "o1",
    items: [
      { total: 120, tax_total: 20, tax_lines: [{ rate: 20 }] },
      { total: 110, tax_total: 10, tax_lines: [{ rate: 10 }] },
    ],
    shipping_methods: [{ total: 90, tax_total: 15, tax_lines: [{ rate: 20 }] }],
    payment_collections: [
      {
        payments: [
          {
            provider_id: "pp_paytr_paytr",
            captures: [{ amount: 320 }],
            refunds: [{ amount: 110 }],
          },
        ],
      },
    ],
  },
  {
    id: "o2",
    items: [{ total: 50.5, tax_total: 0, tax_lines: [] }],
    payment_collections: [
      {
        payments: [{ provider_id: "pp_bank-transfer_bank-transfer", captures: [{ amount: 50.5 }] }],
      },
    ],
  },
]

describe("finance report cuts (F11.3)", () => {
  it("splits sales by VAT rate, lines and shipping together, base and VAT to the kuruş", () => {
    expect(vatBreakdown(ORDERS)).toEqual([
      { rate: 20, base: "175.00", tax: "35.00", gross: "210.00" },
      { rate: 10, base: "100.00", tax: "10.00", gross: "110.00" },
      { rate: 0, base: "50.50", tax: "0.00", gross: "50.50" },
    ])
  })

  it("tells money taken and given back by payment method", () => {
    expect(collections(ORDERS)).toEqual([
      { method: "paytr", payments: 1, captured: "320.00", refunded: "110.00", net: "210.00" },
      { method: "bank-transfer", payments: 1, captured: "50.50", refunded: "0.00", net: "50.50" },
    ])
    expect(methodOf("pp_cod_cod")).toBe("cod")
    expect(methodOf(null)).toBe("unknown")
  })
})

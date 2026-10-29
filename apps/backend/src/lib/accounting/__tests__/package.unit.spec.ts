import { packageTables } from "../package"
import type { PackageOrder } from "../package"

const line = (total: number, tax: number, rate: number) => ({
  total,
  tax_total: tax,
  tax_lines: [{ rate }],
})

const order = (over: Partial<PackageOrder>): PackageOrder => ({
  id: "order_1",
  display_id: 101,
  created_at: "2026-10-03T09:00:00Z",
  customer_id: null,
  items: [line(120, 20, 20)],
  shipping_methods: [line(55, 5, 10)],
  ...over,
})

const tables = (orders: PackageOrder[]) =>
  packageTables({
    orders,
    parties: new Map([
      [
        "cus_corp",
        {
          kind: "corporate",
          name: "Atölye Ltd. Şti.",
          tax_office: "Kadıköy",
          tax_id: "1234567890",
        },
      ],
      ["cus_person", { kind: "individual" }],
    ]),
    captures: [
      { order_display_id: 101, day: "2026-10-03", provider_id: "pp_paytr_paytr", amount: 175 },
    ],
    refunds: [
      { order_display_id: 101, day: "2026-10-09", provider_id: "pp_paytr_paytr", amount: "40.5" },
    ],
    dayOf: (at) => new Date(at).toISOString().slice(0, 10),
  })

describe("accounting package", () => {
  it("writes a row per order and VAT rate, with a corporate customer's invoice name and VKN only", () => {
    const { sales } = tables([
      order({ customer_id: "cus_corp" }),
      order({ id: "order_2", display_id: 102, customer_id: "cus_person" }),
    ])

    expect(sales.slice(1)).toEqual([
      [
        "#101",
        "2026-10-03",
        "Kurumsal",
        "Atölye Ltd. Şti.",
        "Kadıköy",
        "1234567890",
        20,
        100,
        20,
        120,
      ],
      [
        "#101",
        "2026-10-03",
        "Kurumsal",
        "Atölye Ltd. Şti.",
        "Kadıköy",
        "1234567890",
        10,
        50,
        5,
        55,
      ],
      ["#102", "2026-10-03", "Bireysel", "", "", "", 20, 100, 20, 120],
      ["#102", "2026-10-03", "Bireysel", "", "", "", 10, 50, 5, 55],
    ])
  })

  it("lists collections and refunds by method, and sums VAT by rate", () => {
    const { collections, returns, vat } = tables([order({}), order({ id: "o2", display_id: 102 })])

    expect(collections.slice(1)).toEqual([["#101", "2026-10-03", "PayTR", 175, null]])
    expect(returns.slice(1)).toEqual([["#101", "2026-10-09", "PayTR", 40.5]])
    expect(vat.slice(1)).toEqual([
      [20, 200, 40, 240],
      [10, 100, 10, 110],
    ])
  })
})

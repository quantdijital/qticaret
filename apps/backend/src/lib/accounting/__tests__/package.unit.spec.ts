import { GIFT_CARD_MOVES, giftCardSplit } from "../gift-cards"
import type { GiftCardOrder } from "../gift-cards"
import { PACKAGE_SHEETS, PACKAGE_TABLES, packageTables } from "../package"
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

  it("takes gift cards out of the sales and VAT, as an advance sold and a card spent (adr/0025, 2026-11-03)", () => {
    const dayOf = (at: string | Date) => new Date(at).toISOString().slice(0, 10)
    // #103 sells a 500 TL card beside a mug; #104 is paid 150 TL by a card, the rest by PayTR
    const sold = [
      { id: "line_mug", ...line(120, 20, 20) },
      { id: "line_gift", total: 500, tax_total: 0, tax_lines: [] },
    ]
    const selling: PackageOrder & GiftCardOrder = order({
      id: "order_3",
      display_id: 103,
      items: sold,
    })
    const spending: PackageOrder & GiftCardOrder = order({
      id: "order_4",
      display_id: 104,
      created_at: "2026-10-09T09:00:00Z",
      version: 2,
      credit_lines: [
        { reference: "gift-card", raw_amount: "150", version: 2 },
        // An earlier version's copy, and store credit: not a card spent this month
        { reference: "gift-card", raw_amount: "150", version: 1 },
        { reference: "store-credit", raw_amount: "30", version: 2 },
      ],
    } as Partial<PackageOrder>)
    const split = [selling, spending].map((each) =>
      giftCardSplit(each, new Set(["line_gift"]), dayOf)
    )
    const { sales, vat, gift_cards } = packageTables({
      orders: split.map((each) => each.order),
      parties: new Map(),
      captures: [],
      refunds: [],
      giftCards: split.flatMap((each) => each.moves),
      dayOf,
    })

    expect(sales.slice(1).filter((row) => row[0] === "#103")).toEqual([
      ["#103", "2026-10-03", "Bireysel", "", "", "", 20, 100, 20, 120],
      ["#103", "2026-10-03", "Bireysel", "", "", "", 10, 50, 5, 55],
    ])
    expect(vat.slice(1)).toEqual([
      [20, 200, 40, 240],
      [10, 100, 10, 110],
    ])
    expect(gift_cards).toEqual([
      ["Hareket", "Sipariş", "Tarih", "Tutar (TL)"],
      [GIFT_CARD_MOVES.sold, "#103", "2026-10-03", 500],
      [GIFT_CARD_MOVES.spent, "#104", "2026-10-09", 150],
      ["Satılan hediye kartı (avans)", "Ay toplamı", "", 500],
      ["Kullanılan hediye kartı", "Ay toplamı", "", 150],
    ])
    expect(PACKAGE_TABLES).toContain("gift_cards")
    expect(PACKAGE_SHEETS.gift_cards).toMatchObject({ file: "hediye-kartlari" })
  })

  it("writes the month's gift card amounts as nothing when no card was sold or spent", () => {
    const { gift_cards } = tables([order({})])

    expect(gift_cards.slice(1)).toEqual([
      ["Satılan hediye kartı (avans)", "Ay toplamı", "", 0],
      ["Kullanılan hediye kartı", "Ay toplamı", "", 0],
    ])
  })
})

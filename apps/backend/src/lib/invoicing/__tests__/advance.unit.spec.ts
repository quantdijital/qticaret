import { eArchiveAttributes } from "../parasut/payload"
import { giftCardSpent, invoiceDraft, invoicePaymentOf, invoiceTotals, invoiceLines } from ".."
import { splitAdvance } from "../advance"
import type { InvoiceOrder } from ".."

const vat20 = [{ rate: 20 }]

// A pan at 20% KDV, a 500 TL gift card at 0% and shipping, as Medusa totals them
const mixed = (): InvoiceOrder => ({
  id: "order_1",
  display_id: 1043,
  created_at: "2026-11-03T09:00:00.000Z",
  currency_code: "try",
  items: [
    {
      id: "line_pan",
      product_title: "Döküm tava",
      quantity: 1,
      subtotal: 100,
      discount_subtotal: 0,
      tax_total: 20,
      total: 120,
      tax_lines: vat20,
    },
    {
      id: "line_gift",
      product_title: "Hediye kartı",
      variant_title: "500 TL",
      quantity: 1,
      subtotal: 500,
      discount_subtotal: 0,
      tax_total: 0,
      total: 500,
      tax_lines: [],
      metadata: { qt_gift: { recipient_email: "zeynep@example.com" } },
    },
  ],
  shipping_methods: [
    {
      name: "Kargo",
      subtotal: 50,
      discount_subtotal: 0,
      tax_total: 10,
      total: 60,
      tax_lines: vat20,
    },
  ],
  billing_address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Moda Cad. No: 1" },
  payment_collections: [
    { payments: [{ provider_id: "pp_paytr_paytr", amount: 680, captured_at: "2026-11-03" }] },
  ],
})

const gifts = new Set(["line_gift"])
const context = { store_url: "https://ornek.com", shipment: null }

describe("a gift card sold on an order is an advance, not the invoice's (docs/mali-musavir-sorulari.md 3.2)", () => {
  it("leaves the gift card line off the invoice and keeps what it came to as the advance", () => {
    const { order, advance } = splitAdvance(mixed(), gifts)
    const totals = invoiceTotals(invoiceLines(order))
    const result = invoiceDraft(order, null, context)

    expect(advance).toBe("500.00")
    expect(order.items?.map((item) => item?.id)).toEqual(["line_pan"])
    expect(totals).toEqual({ net: "150.00", vat: "30.00", gross: "180.00" })
    // The invoice is what was charged less the advance
    expect(Number(totals.gross) + Number(advance)).toBe(680)
    expect(result).toMatchObject({
      draft: {
        lines: [{ description: "Döküm tava" }, { description: "Kargo bedeli - Kargo" }],
        totals: { gross: "180.00" },
      },
    })
  })

  it("leaves an order of gift cards alone with no line to invoice", () => {
    const giftOnly = { ...mixed(), items: [mixed().items?.[1] ?? null], shipping_methods: [] }
    const { order, advance } = splitAdvance(giftOnly, gifts)

    expect(advance).toBe("500.00")
    expect(invoiceLines(order)).toEqual([])
    expect(invoiceDraft(order, null, context)).toEqual({ problems: ["einvoice.no_lines"] })
  })

  it("keeps an order without gift card lines as it was, its advance nothing", () => {
    const { order, advance } = splitAdvance(mixed(), new Set())

    expect(advance).toBe("0.00")
    expect(order.items).toHaveLength(2)
  })
})

describe("an order paid with a gift card, invoiced in full (ODEMEARACISI)", () => {
  const card = (raw_amount: string, version = 2, reference = "gift-card") => ({
    reference,
    raw_amount,
    version,
  })

  it("counts the current version's gift card credit lines, not store credit or one given back", () => {
    expect(
      giftCardSpent({
        version: 2,
        credit_lines: [
          card("150"),
          card("150", 1),
          card("40", 2, "store-credit"),
          card("-20"),
          null,
        ],
      })
    ).toBe(15_000)
  })

  it("is invoiced for the full amount, as paid by a payment instrument, when cards paid it all", () => {
    const paidByCard: InvoiceOrder = {
      ...mixed(),
      items: [mixed().items?.[0] ?? null],
      version: 1,
      payment_collections: [],
      credit_lines: [card("180", 1)],
    }
    const result = invoiceDraft(paidByCard, null, context)

    expect(result).toMatchObject({
      draft: {
        totals: { gross: "180.00" },
        internet_sale: { payment: "gift_card", platform: null, paid_on: "2026-11-03" },
      },
    })
    expect("draft" in result && eArchiveAttributes(result.draft).internet_sale).toEqual({
      url: "https://ornek.com",
      payment_type: "ODEMEARACISI",
      payment_platform: "Hediye kartı",
      payment_date: "2026-11-03",
    })
  })

  it("keeps the card's type when a card paid the rest; store credit alone stays a payment instrument", () => {
    const part = invoicePaymentOf({
      created_at: "2026-11-03T09:00:00Z",
      version: 1,
      credit_lines: [card("100", 1)],
      payment_collections: [{ payments: [{ provider_id: "pp_iyzico_iyzico", amount: 80 }] }],
    })
    const storeCredit = invoicePaymentOf({
      created_at: "2026-11-03T09:00:00Z",
      version: 1,
      credit_lines: [card("180", 1, "store-credit")],
      payment_collections: [],
    })

    expect(part).toMatchObject({ payment: "card", platform: "iyzico" })
    expect(storeCredit).toMatchObject({ payment: "other" })
  })
})

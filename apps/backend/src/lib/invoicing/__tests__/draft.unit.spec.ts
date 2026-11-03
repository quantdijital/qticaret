import { COD_FEE } from "../../payments/cod"
import { ANONYMOUS_TCKN, invoiceDraft, invoiceLines, invoicePaymentOf } from ".."
import type { InvoiceOrder } from ".."

const vat20 = [{ rate: 20 }]

// Totals as Medusa gives them for KDV-inclusive prices (v2.21.2 getLineItemTotals)
const order = (changes: Partial<InvoiceOrder> = {}): InvoiceOrder => ({
  id: "order_1",
  display_id: 1042,
  created_at: "2026-10-30T21:30:00.000Z",
  currency_code: "try",
  email: "ayse@example.com",
  items: [
    {
      product_title: "Döküm tava",
      variant_title: "20 cm",
      variant_id: "variant_1",
      quantity: 2,
      subtotal: 200,
      discount_subtotal: 20,
      tax_total: 36,
      total: 216,
      tax_lines: vat20,
    },
  ],
  shipping_methods: [
    {
      name: "Aras Kargo",
      subtotal: "49.916666666666666667",
      discount_subtotal: 0,
      tax_total: "9.983333333333333333",
      total: "59.9",
      tax_lines: vat20,
    },
  ],
  billing_address: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    address_1: "Moda Cad. No: 1",
    address_2: "Daire 3",
    city: "Kadıköy",
    province: "İstanbul",
    postal_code: "34710",
    phone: "+905551112233",
  },
  payment_collections: [
    { payments: [{ provider_id: "pp_paytr_paytr", amount: 275.9, captured_at: "2026-10-30" }] },
  ],
  ...changes,
})

const context = { store_url: "https://ornek.com", shipment: null }

describe("an order's invoice lines (F8, adr/0034 §3)", () => {
  it("writes each item KDV excluded with its discount, and shipping as a line", () => {
    const lines = invoiceLines(order())

    expect(lines).toEqual([
      {
        description: "Döküm tava - 20 cm",
        quantity: 2,
        unit_net: "100.0000",
        discount_net: "20.00",
        vat_rate: 20,
        net: "180.00",
        vat: "36.00",
        gross: "216.00",
      },
      {
        description: "Kargo bedeli - Aras Kargo",
        quantity: 1,
        unit_net: "49.9167",
        discount_net: "0.00",
        vat_rate: 20,
        net: "49.92",
        vat: "9.98",
        gross: "59.90",
      },
    ])
  })

  it("keeps four decimals of a unit price that does not end on a kuruş", () => {
    const [line] = invoiceLines({
      items: [
        {
          product_title: "Kupa",
          quantity: 3,
          subtotal: 250,
          tax_total: 50,
          total: 300,
          tax_lines: vat20,
        },
      ],
    })

    expect(line).toMatchObject({ unit_net: "83.3333", net: "250.00", gross: "300.00" })
  })

  it("names a line's add-ons, never the text the buyer typed (adr/0052 §9)", () => {
    const [line] = invoiceLines({
      items: [
        {
          product_title: "Çakı",
          variant_title: "Standart",
          variant_id: "variant_1",
          is_custom_price: true,
          metadata: {
            qt_addons: {
              base: 1000,
              non_withdrawable: true,
              max_quantity: null,
              items: [
                { addon_id: "ad_1", kind: "text", label: "Ürün üzerine yazı", value: "Ahmet" },
                {
                  addon_id: "ad_2",
                  kind: "choice",
                  label: "Kılıf",
                  choice_id: "ch_1",
                  choice_label: "Desenli Siyah",
                },
              ],
            },
          },
          quantity: 1,
          subtotal: 1112.5,
          tax_total: 222.5,
          total: 1335,
          tax_lines: vat20,
        },
      ],
    })

    expect(line?.description).toBe("Çakı - Standart - Ürün üzerine yazı - Kılıf: Desenli Siyah")
    expect(line?.description).not.toContain("Ahmet")
  })

  const codFee = (rate = vat20) => ({
    title: "Kapıda ödeme hizmet bedeli",
    metadata: { qt_fee: COD_FEE },
    variant_id: null,
    is_custom_price: true,
    quantity: 1,
    subtotal: 25,
    tax_total: 5,
    total: 30,
    tax_lines: rate,
  })

  it("puts the cash on delivery fee on the shipping line (the accountant, 2.3)", () => {
    const lines = invoiceLines(order({ items: [codFee()] }))

    expect(lines).toEqual([
      {
        description: "Kargo bedeli - Aras Kargo - kapıda ödeme dahil",
        quantity: 1,
        unit_net: "74.9167",
        discount_net: "0.00",
        vat_rate: 20,
        net: "74.92",
        vat: "14.98",
        gross: "89.90",
      },
    ])
  })

  it("leaves the fee a delivery line alone with free shipping, and drops lines edited out", () => {
    const lines = invoiceLines({
      items: [codFee(), { product_title: "Tava kapağı", quantity: 0, subtotal: 0, total: 0 }],
      shipping_methods: [{ name: "Ücretsiz", subtotal: 50, discount_subtotal: 50, total: 0 }],
    })

    expect(lines.map((line) => [line.description, line.gross])).toEqual([
      ["Kargo bedeli - kapıda ödeme", "30.00"],
    ])
  })

  it("keeps a fee at another KDV rate on a line of its own", () => {
    const lines = invoiceLines(order({ items: [codFee([{ rate: 10 }])] }))

    expect(lines.map((line) => [line.description, line.vat_rate])).toEqual([
      ["Kargo bedeli - Aras Kargo", 20],
      ["Kapıda ödeme hizmet bedeli", 10],
    ])
  })
})

describe("an order's invoice draft", () => {
  it("is for the person on the billing address, by the number for one who gave none", () => {
    const result = invoiceDraft(order(), null, context)

    expect(result).toMatchObject({
      draft: {
        order: { id: "order_1", number: "1042", date: "2026-10-31" },
        currency: "TRY",
        buyer: {
          kind: "person",
          name: "Ayşe Yılmaz",
          tax_id: ANONYMOUS_TCKN,
          address: "Moda Cad. No: 1 Daire 3",
          city: "İstanbul",
          district: "Kadıköy",
        },
        totals: { net: "229.92", vat: "45.98", gross: "275.90" },
        internet_sale: {
          url: "https://ornek.com",
          payment: "card",
          platform: "PayTR",
          paid_on: "2026-10-30",
        },
        shipment: null,
      },
    })
  })

  it("is for the company of a corporate profile, and asks for its tax office", () => {
    const company = {
      type: "corporate" as const,
      legal_name: "Örnek Ltd. Şti.",
      tax_office: "Kadıköy",
      tax_id: "1234567890",
    }

    expect(invoiceDraft(order(), company, context)).toMatchObject({
      draft: { buyer: { kind: "company", name: "Örnek Ltd. Şti.", tax_id: "1234567890" } },
    })
    expect(invoiceDraft(order(), { ...company, tax_office: " " }, context)).toEqual({
      problems: ["einvoice.tax_office_missing"],
    })
  })

  it("says what is missing: another currency, the storefront, the carrier's identity", () => {
    const shipped = { carrier: null, shipped_at: new Date("2026-10-31T09:00:00Z") }

    expect(
      invoiceDraft(order({ currency_code: "eur" }), null, { store_url: " ", shipment: shipped })
    ).toEqual({
      problems: [
        "einvoice.currency_unsupported",
        "einvoice.store_url_missing",
        "einvoice.carrier_identity_missing",
      ],
    })
  })

  it("writes the carrier that took the parcel and the day it left", () => {
    const carrier = { title: "Örnek Kargo A.Ş.", tax_id: "1111111111" }
    const result = invoiceDraft(order(), null, {
      ...context,
      shipment: { carrier, shipped_at: new Date("2026-10-31T22:00:00Z") },
    })

    expect(result).toMatchObject({ draft: { shipment: { carrier, shipped_on: "2026-11-01" } } })
  })
})

describe("how an order was paid, for the e-Arşiv", () => {
  it("goes by the largest payment other than a gift card", () => {
    const paid = (payments: { provider_id: string; amount: number }[]) =>
      invoicePaymentOf({ created_at: "2026-10-30T10:00:00Z", payment_collections: [{ payments }] })

    expect(
      paid([
        { provider_id: "pp_gift-card_gift-card", amount: 200 },
        { provider_id: "pp_iyzico_iyzico", amount: 50 },
      ])
    ).toMatchObject({ payment: "card", platform: "iyzico" })
    expect(paid([{ provider_id: "pp_gift-card_gift-card", amount: 200 }])).toMatchObject({
      payment: "gift_card",
      platform: null,
    })
    expect(paid([{ provider_id: "pp_cod_cod", amount: 90 }])).toMatchObject({
      payment: "cash_on_delivery",
      platform: null,
    })
    expect(paid([{ provider_id: "pp_bank-transfer_bank-transfer", amount: 90 }])).toMatchObject({
      payment: "bank_transfer",
    })
  })
})

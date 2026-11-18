import { COD_FEE } from "../../../payments/cod"
import { ANONYMOUS_TCKN, invoiceDraft, invoiceItemRefs } from "../.."
import type { InvoiceOrder, InvoiceProfile } from "../.."
import { birfaturaOrder, birfaturaProductId } from "../map"
import type { BirfaturaSource, ShippingTo } from "../map"

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
      id: "ordli_1",
      product_title: "Döküm tava",
      variant_title: "20 cm",
      variant_id: "variant_1",
      variant_sku: "TAVA-20",
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

const shippingTo: ShippingTo = {
  name: "Ayşe Yılmaz",
  address: "Bağdat Cad. No: 5",
  district: "Maltepe",
  city: "İstanbul",
  postal_code: "34840",
  phone: "+905554443322",
}

function source(
  sold: InvoiceOrder = order(),
  profile: InvoiceProfile | null = null,
  changes: Partial<BirfaturaSource> = {}
): BirfaturaSource {
  const result = invoiceDraft(sold, profile, { store_url: "https://ornek.com", shipment: null })
  if (!("draft" in result)) {
    throw new Error(`no draft: ${result.problems.join(",")}`)
  }
  return {
    draft: result.draft,
    items: invoiceItemRefs(sold),
    shipping: shippingTo,
    order_id: 1042,
    order_code: "1042",
    ordered_at: new Date(sold.created_at),
    ...changes,
  }
}

const mapped = (input: BirfaturaSource) => {
  const result = birfaturaOrder(input)
  if (!("order" in result)) {
    throw new Error(result.problem)
  }
  return result.order
}

describe("a draft as BirFatura's order (adr/0072 §5)", () => {
  it("writes a person's order with the document's field names and unrounded amounts", () => {
    const out = mapped(source())

    expect(out).toMatchObject({
      OrderId: 1042,
      OrderCode: "1042",
      // 21:30 UTC is past midnight in Türkiye
      OrderDate: "31.10.2026 00:30:00",
      BillingName: "Ayşe Yılmaz",
      BillingAddress: "Moda Cad. No: 1 Daire 3",
      BillingTown: "Kadıköy",
      BillingCity: "İstanbul",
      BillingMobilePhone: "+905551112233",
      SSNTCNo: ANONYMOUS_TCKN,
      TaxNo: null,
      TaxOffice: null,
      Email: "ayse@example.com",
      ShippingName: "Ayşe Yılmaz",
      ShippingTown: "Maltepe",
      ShippingCity: "İstanbul",
      SalesChannelWebSite: "https://ornek.com",
      PaymentTypeId: 1,
      PaymentType: "Kredi/Banka Kartı",
      Currency: "TRY",
      TotalPaidTaxExcluding: 229.92,
      TotalPaidTaxIncluding: 275.9,
      ProductsTotalTaxExcluding: 180,
      ProductsTotalTaxIncluding: 216,
      ShippingChargeTotalTaxExcluding: 49.92,
      ShippingChargeTotalTaxIncluding: 59.9,
      DiscountTotalTaxExcluding: 0,
      DiscountTotalTaxIncluding: 0,
    })
    expect(out.OrderDetails).toEqual([
      {
        ProductId: birfaturaProductId("variant_1"),
        ProductCode: "TAVA-20",
        ProductName: "Döküm tava - 20 cm",
        ProductQuantityType: "Adet",
        ProductQuantity: 2,
        VatRate: 20,
        ProductUnitPriceTaxExcluding: 100,
        ProductUnitPriceTaxIncluding: 120,
        DiscountUnitTaxExcluding: 10,
        DiscountUnitTaxIncluding: 12,
      },
    ])
  })

  it("keeps four places of a unit price that does not end on a kuruş", () => {
    const sold = order({
      items: [
        {
          id: "ordli_1",
          product_title: "Bıçak",
          variant_id: "variant_2",
          quantity: 3,
          subtotal: "249.916666666666666667",
          discount_subtotal: 0,
          tax_total: "49.983333333333333333",
          total: "299.9",
          tax_lines: vat20,
        },
      ],
    })

    const [line] = mapped(source(sold)).OrderDetails

    expect(line?.ProductUnitPriceTaxExcluding).toBe(83.3056)
    expect(line?.ProductUnitPriceTaxIncluding).toBe(99.9667)
    // No SKU: the variant's id names it
    expect(line?.ProductCode).toBe("variant_2")
  })

  it("writes a company's tax number and office, not a T.C. kimlik", () => {
    const profile: InvoiceProfile = {
      type: "corporate",
      legal_name: "Örnek Ticaret A.Ş.",
      tax_office: "Kadıköy",
      tax_id: "1234567801",
    }

    const out = mapped(source(order(), profile))

    expect(out).toMatchObject({
      BillingName: "Örnek Ticaret A.Ş.",
      TaxNo: "1234567801",
      TaxOffice: "Kadıköy",
      SSNTCNo: null,
    })
  })

  it("puts the cash on delivery fee in the shipping charge, with no line of its own", () => {
    const sold = order({
      items: [
        ...(order().items ?? []),
        {
          id: "ordli_fee",
          title: "Kapıda ödeme hizmet bedeli",
          metadata: { qt_fee: COD_FEE },
          variant_id: null,
          is_custom_price: true,
          quantity: 1,
          subtotal: 25,
          tax_total: 5,
          total: 30,
          tax_lines: vat20,
        },
      ],
      payment_collections: [
        { payments: [{ provider_id: "pp_cod_cod", amount: 305.9, captured_at: "2026-10-30" }] },
      ],
    })

    const out = mapped(source(sold))

    expect(out.OrderDetails).toHaveLength(1)
    expect(out.ShippingChargeTotalTaxExcluding).toBe(74.92)
    expect(out.ShippingChargeTotalTaxIncluding).toBe(89.9)
    expect(out.PaymentTypeId).toBe(3)
  })

  it("takes the delivery phone when the billing address has none, and refuses an order with neither", () => {
    const noPhone = order({
      billing_address: { ...order().billing_address, phone: null },
    })

    expect(mapped(source(noPhone)).BillingMobilePhone).toBe("+905554443322")
    expect(
      birfaturaOrder(source(noPhone, null, { shipping: { ...shippingTo, phone: null } }))
    ).toEqual({ problem: "einvoice.phone_missing" })
  })

  it("delivers to the billing address when the order has no delivery address", () => {
    const out = mapped(source(undefined, null, { shipping: null }))

    expect(out).toMatchObject({
      ShippingName: "Ayşe Yılmaz",
      ShippingAddress: "Moda Cad. No: 1 Daire 3",
      ShippingTown: "Kadıköy",
      ShippingCity: "İstanbul",
    })
  })

  it("gives a product the same id every pull, never 0, within a JavaScript number", () => {
    const id = birfaturaProductId("variant_01JXYZ")

    expect(birfaturaProductId("variant_01JXYZ")).toBe(id)
    expect(birfaturaProductId("variant_01JXYW")).not.toBe(id)
    expect(id).toBeGreaterThan(0)
    expect(Number.isSafeInteger(id)).toBe(true)
  })
})

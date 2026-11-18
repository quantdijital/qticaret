import { createHash } from "node:crypto"
import { MathBN } from "@medusajs/framework/utils"
import type { InvoiceDraft, InvoiceLine } from "../types"
import { formatBirfaturaDate } from "./dates"
import { birfaturaTexts } from "./texts"
import { BIRFATURA_PAYMENTS } from "./types"
import type { BirfaturaOrder, BirfaturaOrderLine } from "./types"

/**
 * An invoice draft (adr/0034 §3) as BirFatura's `Orders[]` item (adr/0072
 * §5). Pure: every amount is the draft's, computed on the server from the
 * order; amounts go as numbers, unrounded beyond the draft's own places
 * ("Tutarlar yuvarlanmadan gönderilmelidir").
 */

export interface ItemRef {
  /** The order line's id, the variant's and its SKU; for the product's code and id. */
  line_id: string | null
  variant_id: string | null
  sku: string | null
}

export interface ShippingTo {
  name: string | null
  address: string | null
  district: string | null
  city: string | null
  postal_code: string | null
  phone: string | null
}

export interface BirfaturaSource {
  draft: InvoiceDraft
  /** The draft's item lines' refs, in its order: the lines after them are delivery. */
  items: readonly ItemRef[]
  shipping: ShippingTo | null
  /** BirFatura's `OrderId` and `OrderCode` (`birfaturaOrderId`). */
  order_id: number
  order_code: string
  ordered_at: Date
}

export type MappedOrder =
  { order: BirfaturaOrder } | { problem: "einvoice.phone_missing" | "einvoice.address_missing" }

const PLACES = 4

const num = (value: string | number): number => Number(value)

/** A KDV-excluded amount with the line's KDV added, to the draft's four places. */
const withVat = (net: string, rate: number): number =>
  num(MathBN.div(MathBN.mult(net, 100 + rate), 100).toFixed(PLACES))

const sum = (lines: readonly InvoiceLine[], pick: (line: InvoiceLine) => string): number =>
  num(lines.reduce((total, line) => MathBN.add(total, pick(line)), MathBN.convert(0)).toFixed(2))

/**
 * A stable product id from the variant's (or the line's) id: BirFatura wants
 * a long, Medusa's ids are text. The first 52 bits of its SHA-256, plus one:
 * never 0, within a JavaScript number, the same every pull.
 */
export function birfaturaProductId(key: string): number {
  return parseInt(createHash("sha256").update(key).digest("hex").slice(0, 13), 16) + 1
}

function orderLine(line: InvoiceLine, ref: ItemRef, index: number): BirfaturaOrderLine {
  const discountUnit = MathBN.div(line.discount_net, line.quantity).toFixed(PLACES)
  const key = ref.variant_id ?? ref.line_id ?? `${line.description}#${String(index)}`
  const sku = ref.sku?.trim() ?? ""
  return {
    ProductId: birfaturaProductId(key),
    ProductCode: sku !== "" ? sku : (ref.variant_id ?? `SATIR-${String(index + 1)}`),
    ProductName: line.description,
    ProductQuantityType: "Adet",
    ProductQuantity: line.quantity,
    VatRate: line.vat_rate,
    ProductUnitPriceTaxExcluding: num(line.unit_net),
    ProductUnitPriceTaxIncluding: withVat(line.unit_net, line.vat_rate),
    DiscountUnitTaxExcluding: num(discountUnit),
    DiscountUnitTaxIncluding: withVat(discountUnit, line.vat_rate),
  }
}

const text = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

/**
 * The order BirFatura is to invoice, or why it cannot be listed yet. No
 * phone on the billing or the delivery address keeps it out (BirFatura
 * requires one; none is made up); so does an address with neither its
 * district nor its province.
 */
export function birfaturaOrder(source: BirfaturaSource): MappedOrder {
  const { draft } = source
  const { buyer } = draft
  const phone = text(buyer.phone) ?? text(source.shipping?.phone)
  if (!phone) {
    return { problem: "einvoice.phone_missing" }
  }
  const town = text(buyer.district) ?? text(buyer.city)
  const city = text(buyer.city) ?? text(buyer.district)
  const to = source.shipping
  const shipTown = text(to?.district) ?? text(to?.city) ?? town
  const shipCity = text(to?.city) ?? text(to?.district) ?? city
  if (!town || !city || !shipTown || !shipCity) {
    return { problem: "einvoice.address_missing" }
  }
  const items = draft.lines.slice(0, source.items.length)
  const delivery = draft.lines.slice(source.items.length)
  const company = buyer.kind === "company"
  return {
    order: {
      OrderId: source.order_id,
      OrderCode: source.order_code,
      OrderDate: formatBirfaturaDate(source.ordered_at),
      BillingName: buyer.name,
      BillingAddress: buyer.address,
      BillingTown: town,
      BillingCity: city,
      BillingMobilePhone: phone,
      TaxOffice: company ? buyer.tax_office : null,
      TaxNo: company ? buyer.tax_id : null,
      SSNTCNo: company ? null : buyer.tax_id,
      Email: buyer.email,
      ShippingName: text(to?.name) ?? buyer.name,
      ShippingAddress: text(to?.address) ?? buyer.address,
      ShippingTown: shipTown,
      ShippingCity: shipCity,
      ShippingCountry: "Türkiye",
      ShippingZipCode: text(to?.postal_code) ?? buyer.postal_code,
      ShippingPhone: text(to?.phone),
      ShipCompany: draft.shipment?.carrier.title ?? null,
      SalesChannelWebSite: draft.internet_sale.url,
      PaymentTypeId: BIRFATURA_PAYMENTS[draft.internet_sale.payment],
      PaymentType: birfaturaTexts().payments[draft.internet_sale.payment],
      Currency: "TRY",
      TotalPaidTaxExcluding: num(draft.totals.net),
      TotalPaidTaxIncluding: num(draft.totals.gross),
      ProductsTotalTaxExcluding: sum(items, (line) => line.net),
      ProductsTotalTaxIncluding: sum(items, (line) => line.gross),
      // Shipping, with the cash on delivery fee in it (adr/0034 Ek 1)
      ShippingChargeTotalTaxExcluding: sum(delivery, (line) => line.net),
      ShippingChargeTotalTaxIncluding: sum(delivery, (line) => line.gross),
      // The draft spreads an order's discount over its lines
      DiscountTotalTaxExcluding: 0,
      DiscountTotalTaxIncluding: 0,
      OrderDetails: items.map((line, index) =>
        orderLine(
          line,
          source.items[index] ?? { line_id: null, variant_id: null, sku: null },
          index
        )
      ),
    },
  }
}

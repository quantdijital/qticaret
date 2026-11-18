/**
 * BirFatura's "Özel Entegrasyon API" (adr/0072): BirFatura calls the shop's
 * five services and pulls the orders it is to invoice. Field names are the
 * document's, case included ("Response modelleri ve alan adları büyük/küçük
 * harf dahil dokümandaki yapıyla uyumlu olmalıdır"). Source:
 * developers-api.birfatura.com/api/portal/dokumanlar/ozel-entegrasyon-api.
 */

/** Our order states as BirFatura lists them; only `ready` returns orders. */
export const BIRFATURA_STATUSES = { ready: 1, invoiced: 2, cancelled: 3 } as const

/**
 * Payment method ids, fixed for good: BirFatura keeps the shop's mapping of
 * them. In the order of `INVOICE_PAYMENTS` (lib/invoicing/types.ts).
 */
export const BIRFATURA_PAYMENTS = {
  card: 1,
  bank_transfer: 2,
  cash_on_delivery: 3,
  gift_card: 4,
  other: 5,
} as const

/** At most this many orders an answer; the rest come with the next pull. */
export const MAX_ORDERS_PER_PULL = 100
/** The widest date range a pull may ask for. */
export const MAX_PULL_DAYS = 31

/**
 * An exchange's sale invoice is the order's second sale (adr/0034 E6b) and
 * needs an id of its own: this plus the order's number × 100 plus its
 * place among the order's exchanges (adr/0072 §5). Never meets a first
 * sale's id (an order's number) below a trillion orders.
 */
export const EXCHANGE_ORDER_ID_BASE = 1_000_000_000_000
export const MAX_EXCHANGES_PER_ORDER = 99

export interface BirfaturaListItem {
  Id: number
  Value: string
}

export interface BirfaturaOrderLine {
  ProductId: number
  ProductCode: string
  ProductName: string
  ProductQuantityType: string
  ProductQuantity: number
  VatRate: number
  ProductUnitPriceTaxExcluding: number
  ProductUnitPriceTaxIncluding: number
  DiscountUnitTaxExcluding: number
  DiscountUnitTaxIncluding: number
}

export interface BirfaturaOrder {
  OrderId: number
  OrderCode: string
  OrderDate: string
  BillingName: string
  BillingAddress: string
  BillingTown: string
  BillingCity: string
  BillingMobilePhone: string
  TaxOffice: string | null
  TaxNo: string | null
  SSNTCNo: string | null
  Email: string | null
  ShippingName: string
  ShippingAddress: string
  ShippingTown: string
  ShippingCity: string
  ShippingCountry: string
  ShippingZipCode: string | null
  ShippingPhone: string | null
  ShipCompany: string | null
  SalesChannelWebSite: string
  PaymentTypeId: number
  PaymentType: string
  Currency: "TRY"
  TotalPaidTaxExcluding: number
  TotalPaidTaxIncluding: number
  ProductsTotalTaxExcluding: number
  ProductsTotalTaxIncluding: number
  ShippingChargeTotalTaxExcluding: number
  ShippingChargeTotalTaxIncluding: number
  DiscountTotalTaxExcluding: number
  DiscountTotalTaxIncluding: number
  OrderDetails: BirfaturaOrderLine[]
}

/** What a service answers besides its list: the document's `{ Success, Message }`. */
export interface BirfaturaResult {
  Success: boolean
  Message: string
}

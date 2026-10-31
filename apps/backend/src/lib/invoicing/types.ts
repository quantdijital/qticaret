/**
 * An invoice as the shop's program is asked to issue it (F8, adr/0034 §3):
 * computed here from the order, whatever program issues it. Amounts are
 * lira as decimal text; a line's unit price keeps four decimals (a price
 * with KDV taken out rarely ends on a kuruş), every other amount two.
 */

/** How the order was paid, as the e-Arşiv's internet sale details name it. */
export const INVOICE_PAYMENTS = [
  "card",
  "bank_transfer",
  "cash_on_delivery",
  "gift_card",
  "other",
] as const
export type InvoicePayment = (typeof INVOICE_PAYMENTS)[number]

/** Written on an e-Arşiv for a buyer who gave no T.C. kimlik number (docs/mali-musavir-sorulari.md 1.1). */
export const ANONYMOUS_TCKN = "11111111111"

export interface InvoiceLine {
  description: string
  quantity: number
  /** Before the discount, KDV excluded. */
  unit_net: string
  /** The line's discount, KDV excluded; "0.00" for none. */
  discount_net: string
  vat_rate: number
  /** After the discount, KDV excluded. */
  net: string
  vat: string
  gross: string
}

export interface InvoiceBuyer {
  kind: "person" | "company"
  name: string
  /** VKN for a company; T.C. kimlik for a person (or a sole trader's company). */
  tax_id: string
  tax_office: string | null
  email: string | null
  phone: string | null
  address: string
  /** İl. */
  city: string | null
  /** İlçe. */
  district: string | null
  postal_code: string | null
}

export interface InvoiceDraft {
  order: { id: string; number: string; date: string }
  currency: "TRY"
  buyer: InvoiceBuyer
  lines: InvoiceLine[]
  totals: { net: string; vat: string; gross: string }
  internet_sale: {
    url: string
    payment: InvoicePayment
    /** The payment intermediary's name (PayTR, iyzico); null when none. */
    platform: string | null
    paid_on: string
  }
  /** Null until the parcel leaves. */
  shipment: { carrier: { title: string; tax_id: string }; shipped_on: string } | null
  /**
   * A return's document (the accountant, 2026-10-31): the sale invoice it
   * belongs to, by its number and day, and which document it is.
   */
  return_of?: {
    document: "expense_voucher" | "return_invoice"
    number: string | null
    issued_on: string | null
  }
}

/** Why an order cannot be invoiced yet; each a code the panel names. */
export type DraftProblem =
  | "einvoice.currency_unsupported"
  | "einvoice.no_lines"
  | "einvoice.buyer_name_missing"
  | "einvoice.address_missing"
  | "einvoice.tax_office_missing"
  | "einvoice.carrier_identity_missing"
  | "einvoice.store_url_missing"

export type DraftResult = { draft: InvoiceDraft } | { problems: DraftProblem[] }

import { MathBN } from "@medusajs/framework/utils"
import { turkishDay } from "../dashboard/period"
import type { MedusaAmount } from "../money"
import { methodOf } from "../reports/finance"
import { giftCardSpent } from "./advance"
import type { CreditLineRow } from "./advance"
import { invoiceLines, invoiceTotals } from "./lines"
import type { InvoiceItem, InvoiceShippingMethod } from "./lines"
import { ANONYMOUS_TCKN } from "./types"
import type { DraftProblem, DraftResult, InvoiceBuyer, InvoiceDraft, InvoicePayment } from "./types"

type Rows<T> = (T | null)[] | null | undefined

export interface InvoiceAddress {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  /** İlçe, as the Turkish address form keeps it. */
  city?: string | null
  /** İl. */
  province?: string | null
  postal_code?: string | null
  phone?: string | null
}

export interface InvoicePaymentRow {
  provider_id?: string | null
  amount?: MedusaAmount | null
  captured_at?: string | Date | null
  created_at?: string | Date | null
}

export interface InvoiceOrder {
  id: string
  display_id?: number | null
  created_at: string | Date
  currency_code?: string | null
  email?: string | null
  items?: Rows<InvoiceItem>
  shipping_methods?: Rows<InvoiceShippingMethod>
  billing_address?: InvoiceAddress | null
  shipping_address?: InvoiceAddress | null
  payment_collections?: Rows<{ payments?: Rows<InvoicePaymentRow> }>
  /** Gift cards and store credit spent on it (the loyalty plugin's credit lines). */
  credit_lines?: Rows<CreditLineRow>
  version?: number | null
}

/** The customer's invoice identity (adr/0009), its tax id opened for this invoice only. */
export interface InvoiceProfile {
  type: "individual" | "corporate"
  legal_name: string
  tax_office: string | null
  tax_id: string
}

export interface DraftContext {
  /** The storefront's address, written as where the sale was made. */
  store_url: string | null
  /** The carrier that took the parcel and when; null until it leaves. */
  shipment: { carrier: { title: string; tax_id: string } | null; shipped_at: Date } | null
}

const present = <T>(rows: Rows<T>): T[] => (rows ?? []).filter((row): row is T => row !== null)

/** The text trimmed; null for none or only spaces. */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : null
}

const PLATFORMS: Readonly<Record<string, string>> = { paytr: "PayTR", iyzico: "iyzico" }
const METHODS: Readonly<Record<string, InvoicePayment>> = {
  paytr: "card",
  iyzico: "card",
  "bank-transfer": "bank_transfer",
  cod: "cash_on_delivery",
  "gift-card": "gift_card",
}

/**
 * How the order was paid: by its largest payment other than a gift card
 * (a card paying the rest is what the buyer paid with); a gift card when
 * that was all, its credit lines included: an order the cards paid in full
 * took no payment, and its invoice (for the full amount) says
 * `ODEMEARACISI` (docs/mali-musavir-sorulari.md 3.2). The e-Arşiv carries
 * one payment type, so a card paying part keeps the rest's.
 */
export function invoicePaymentOf(
  order: Pick<InvoiceOrder, "payment_collections" | "created_at" | "credit_lines" | "version">
) {
  const payments = present(order.payment_collections)
    .flatMap((collection) => present(collection.payments))
    .sort((a, b) => (MathBN.gt(b.amount ?? 0, a.amount ?? 0) ? 1 : -1))
  const main =
    payments.find((payment) => methodOf(payment.provider_id) !== "gift-card") ?? payments[0]
  if (!main && giftCardSpent(order) > 0) {
    return {
      payment: "gift_card" as const,
      platform: null,
      paid_on: turkishDay(new Date(order.created_at)),
    }
  }
  const method = methodOf(main?.provider_id)
  return {
    payment: METHODS[method] ?? ("other" as const),
    platform: PLATFORMS[method] ?? null,
    paid_on: turkishDay(new Date(main?.captured_at ?? main?.created_at ?? order.created_at)),
  }
}

/**
 * Who the invoice is for. A company profile names the company (a sole
 * trader's by its T.C. kimlik); otherwise the person on the billing
 * address, by the T.C. kimlik in their profile or, without one, the
 * number a buyer who gave none is written with.
 */
export function invoiceBuyer(
  order: Pick<InvoiceOrder, "billing_address" | "shipping_address" | "email">,
  profile: InvoiceProfile | null
): { buyer: InvoiceBuyer } | { problems: DraftProblem[] } {
  const address = order.billing_address ?? order.shipping_address ?? null
  const company = profile?.type === "corporate"
  const person = [address?.first_name, address?.last_name].map(clean).filter(Boolean).join(" ")
  const name = company ? clean(profile.legal_name) : (clean(person) ?? clean(profile?.legal_name))
  const street = [address?.address_1, address?.address_2].map(clean).filter(Boolean).join(" ")
  const problems: DraftProblem[] = []
  if (!name) {
    problems.push("einvoice.buyer_name_missing")
  }
  if (!street) {
    problems.push("einvoice.address_missing")
  }
  if (company && !clean(profile.tax_office)) {
    problems.push("einvoice.tax_office_missing")
  }
  if (problems.length > 0 || !name) {
    return { problems }
  }
  return {
    buyer: {
      kind: company ? "company" : "person",
      name,
      tax_id: profile?.tax_id ?? ANONYMOUS_TCKN,
      tax_office: company ? clean(profile.tax_office) : null,
      email: clean(order.email),
      phone: clean(address?.phone),
      address: street,
      city: clean(address?.province),
      district: clean(address?.city),
      postal_code: clean(address?.postal_code),
    },
  }
}

/**
 * The invoice an order asks for (adr/0034 §3), or why it cannot be made
 * yet. Every amount comes from the order as Medusa totalled it; nothing a
 * client sent is read. Pure.
 */
export function invoiceDraft(
  order: InvoiceOrder,
  profile: InvoiceProfile | null,
  context: DraftContext
): DraftResult {
  const problems: DraftProblem[] = []
  if ((order.currency_code ?? "").toLowerCase() !== "try") {
    problems.push("einvoice.currency_unsupported")
  }
  const lines = invoiceLines(order)
  if (lines.length === 0) {
    problems.push("einvoice.no_lines")
  }
  const buyer = invoiceBuyer(order, profile)
  if ("problems" in buyer) {
    problems.push(...buyer.problems)
  }
  const url = clean(context.store_url)
  if (!url) {
    problems.push("einvoice.store_url_missing")
  }
  if (context.shipment && !context.shipment.carrier) {
    problems.push("einvoice.carrier_identity_missing")
  }
  if (problems.length > 0 || "problems" in buyer || !url) {
    return { problems }
  }
  const draft: InvoiceDraft = {
    order: {
      id: order.id,
      number: String(order.display_id ?? order.id),
      date: turkishDay(new Date(order.created_at)),
    },
    currency: "TRY",
    buyer: buyer.buyer,
    lines,
    totals: invoiceTotals(lines),
    internet_sale: { url, ...invoicePaymentOf(order) },
    shipment: context.shipment?.carrier
      ? {
          carrier: context.shipment.carrier,
          shipped_on: turkishDay(context.shipment.shipped_at),
        }
      : null,
  }
  return { draft }
}

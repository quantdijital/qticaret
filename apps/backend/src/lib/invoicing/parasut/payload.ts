import { ANONYMOUS_TCKN } from "../types"
import type { InvoiceBuyer, InvoiceDraft, InvoicePayment } from "../types"

/**
 * Our invoice draft as Paraşüt's API v4 takes it (apidocs.parasut.com
 * swagger.json): a contact, a sales invoice with its lines inside
 * `relationships.details`, and the e-Arşiv's internet sale and shipment
 * details. Amounts stay text: unit prices four decimals, the rest two.
 */

/** e-Arşiv `internet_sale.payment_type`: Paraşüt's four values. */
const PAYMENT_TYPES: Readonly<Record<InvoicePayment, string>> = {
  card: "KREDIKARTI/BANKAKARTI",
  bank_transfer: "EFT/HAVALE",
  cash_on_delivery: "KAPIDAODEME",
  // Paraşüt lists no "other": the nearest of its values (docs/mali-musavir-sorulari.md 3.2)
  gift_card: "ODEMEARACISI",
  other: "ODEMEARACISI",
}

const PAYMENT_NAMES: Readonly<Record<InvoicePayment, string>> = {
  card: "Kart",
  bank_transfer: "Havale/EFT",
  cash_on_delivery: "Kapıda ödeme",
  gift_card: "Hediye kartı",
  other: "Diğer",
}

/** A buyer worth looking up: one with their own tax id (a T.C. kimlik or a VKN). */
export const hasOwnTaxId = (buyer: InvoiceBuyer): boolean => buyer.tax_id !== ANONYMOUS_TCKN

export function contactAttributes(buyer: InvoiceBuyer) {
  return {
    name: buyer.name,
    contact_type: buyer.kind,
    account_type: "customer",
    tax_number: buyer.tax_id,
    ...(buyer.tax_office ? { tax_office: buyer.tax_office } : {}),
    ...(buyer.email ? { email: buyer.email } : {}),
    ...(buyer.phone ? { phone: buyer.phone } : {}),
    address: buyer.address,
    ...(buyer.city ? { city: buyer.city } : {}),
    ...(buyer.district ? { district: buyer.district } : {}),
    country: "Türkiye",
  }
}

export function salesInvoiceBody(draft: InvoiceDraft, contactId: string, issueDate: string) {
  const { buyer } = draft
  return {
    attributes: {
      item_type: "invoice",
      description: `Sipariş #${draft.order.number}`,
      issue_date: issueDate,
      due_date: issueDate,
      currency: "TRL",
      // Both or neither for an e-document
      order_no: draft.order.number,
      order_date: draft.order.date,
      tax_number: buyer.tax_id,
      ...(buyer.tax_office ? { tax_office: buyer.tax_office } : {}),
      billing_address: buyer.address,
      ...(buyer.phone ? { billing_phone: buyer.phone } : {}),
      ...(buyer.city ? { city: buyer.city } : {}),
      ...(buyer.district ? { district: buyer.district } : {}),
      country: "Türkiye",
    },
    relationships: {
      contact: { data: { id: contactId, type: "contacts" } },
      details: {
        data: draft.lines.map((line) => ({
          type: "sales_invoice_details",
          attributes: {
            quantity: line.quantity,
            unit_price: line.unit_net,
            vat_rate: line.vat_rate,
            discount_type: "amount",
            discount_value: line.discount_net,
            description: line.description,
          },
        })),
      },
    },
  }
}

/** What an e-Arşiv for an internet sale must carry: where and how it was paid, who carried it. */
export function eArchiveAttributes(draft: InvoiceDraft) {
  const { internet_sale: sale, shipment } = draft
  const carrierId = shipment?.carrier.tax_id ?? ""
  return {
    internet_sale: {
      url: sale.url,
      payment_type: PAYMENT_TYPES[sale.payment],
      payment_platform: sale.platform ?? PAYMENT_NAMES[sale.payment],
      payment_date: sale.paid_on,
    },
    ...(shipment
      ? {
          shipment: {
            // A company carries by its VKN; a person (a sole trader) by T.C. kimlik
            ...(carrierId.length === 10
              ? { title: shipment.carrier.title, vkn: carrierId }
              : { name: shipment.carrier.title, tckn: carrierId }),
            date: shipment.shipped_on,
          },
        }
      : {}),
  }
}

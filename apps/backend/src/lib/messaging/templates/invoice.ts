import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** An order's invoice as its message shows it (F8, adr/0034 §7). */
export interface InvoiceVars {
  number: string
  customerName: string
  invoiceNumber: string
  /** "e-Arşiv" or "e-Fatura". */
  documentName: string
  /** The order's page, where the PDF is; null when the order has no link. */
  orderUrl: string | null
}

/**
 * Required: an e-Arşiv invoice of an online sale reaches its buyer
 * electronically (VUK 509 sıra no.lu GT; adr/0036 Ek 2026-11-10).
 */
const EDIT: EditSpec<InvoiceVars> = {
  group: "order",
  required: true,
  tokens: {
    mağaza_adı: "shop",
    müşteri_adı: "name",
    sipariş_no: "number",
    fatura_no: "invoice",
    fatura_türü: "document",
  },
  fields: {
    subject: "order_invoiced.subject",
    preheader: "order_invoiced.preheader",
    heading: "order_invoiced.heading",
    intro: "order_invoiced.intro",
  },
  values: (vars, brand) => ({
    shop: brand.shopName,
    name: vars.customerName,
    number: vars.number,
    invoice: vars.invoiceNumber,
    document: vars.documentName,
  }),
}

/**
 * "Faturanız hazır": the invoice's number and the order's page to download
 * it from. The PDF itself is not attached: it stays in the shop's private
 * storage and is read through the order's own page.
 */
export const orderInvoiced: MessageTemplate<InvoiceVars> = {
  name: "order.invoiced",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: EDIT,
  email: (vars, brand, context) => {
    const text = textsFor(EDIT, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        { kind: "button", label: messageText("order_invoiced.button"), url: vars.orderUrl },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    })
  },
  sample: {
    number: "1042",
    customerName: "Ayşe",
    invoiceNumber: "ABC2026000000123",
    documentName: "e-Arşiv",
    orderUrl: "https://magaza.example/siparis/order_ornek?token=ornek",
  },
}

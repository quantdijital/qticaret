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
 * "Faturanız hazır": the invoice's number and the order's page to download
 * it from. The PDF itself is not attached: it stays in the shop's private
 * storage and is read through the order's own page.
 */
export const orderInvoiced: MessageTemplate<InvoiceVars> = {
  name: "order.invoiced",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("order_invoiced.subject", { number: vars.number }),
      preheader: messageText("order_invoiced.preheader", { shop: brand.shopName }),
      heading: messageText("order_invoiced.heading", { name: vars.customerName }),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("order_invoiced.intro", {
            number: vars.number,
            document: vars.documentName,
            invoice: vars.invoiceNumber,
          }),
        },
        { kind: "button", label: messageText("order_invoiced.button"), url: vars.orderUrl },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    }),
  sample: {
    number: "1042",
    customerName: "Ayşe",
    invoiceNumber: "ABC2026000000123",
    documentName: "e-Arşiv",
    orderUrl: "https://magaza.example/siparis/order_ornek?token=ornek",
  },
}

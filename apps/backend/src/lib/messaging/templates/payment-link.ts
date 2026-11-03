import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A payment link staff made, as the customer receives it (adr/0051 §7). */
export interface PaymentLinkVars {
  customerName: string
  /** `PL-1042`. */
  number: string
  items: { title: string; detail: string | null; quantity: number; total: string }[]
  discount: string | null
  total: string
  /** "72 saat", "5 gün". */
  validity: string
  /** The storefront's `/ode/<token>`. */
  url: string
}

/**
 * "Siparişiniz hazır": the order the customer asked staff for, and the
 * link to pay it. Transactional: they asked for it (adr/0051 §7); no
 * consent asked, but suppression and the day's quota apply. Its link's
 * token is the record's sealed copy, so a lost send can be tried again.
 */
export const paymentLinkSent: MessageTemplate<PaymentLinkVars> = {
  name: "payment_link.sent",
  kind: "transactional",
  channels: ["email", "sms"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("payment_link.subject", { shop: brand.shopName, number: vars.number }),
      preheader: messageText("payment_link.preheader", { total: vars.total }),
      heading: messageText("payment_link.heading", { name: vars.customerName }),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("payment_link.intro", { shop: brand.shopName, number: vars.number }),
        },
        { kind: "items", rows: vars.items },
        {
          kind: "summary",
          rows: [
            ...(vars.discount
              ? [{ label: messageText("payment_link.discount"), value: vars.discount }]
              : []),
            { label: messageText("payment_link.total"), value: vars.total, strong: true },
          ],
        },
        { kind: "button", label: messageText("payment_link.button"), url: vars.url },
        { kind: "note", text: messageText("payment_link.note", { validity: vars.validity }) },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    }),
  sms: (vars, brand) =>
    messageText("payment_link.sms", {
      shop: brand.shopName,
      total: vars.total,
      validity: vars.validity,
      url: vars.url,
    }),
  sample: {
    customerName: "Ayşe",
    number: "PL-1042",
    items: [{ title: "Örnek ürün", detail: "Mavi / M", quantity: 1, total: "₺499,90" }],
    discount: "-₺50,00",
    total: "₺449,90",
    validity: "72 saat",
    url: "https://magaza.example/ode/pl_ornekornekornekornek12.mxyz12.ornek",
  },
}

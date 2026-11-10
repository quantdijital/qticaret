import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
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

/** Required: the customer asked staff for it, and the link reaches them no other way. */
const EDIT: EditSpec<PaymentLinkVars> = {
  group: "order",
  required: true,
  tokens: {
    mağaza_adı: "shop",
    müşteri_adı: "name",
    sipariş_no: "number",
    toplam: "total",
    geçerlilik: "validity",
    ödeme_bağlantısı: "url",
  },
  // The e-mail keeps its fixed button; the SMS has only the shop's text to carry the link
  mustContain: { sms: ["ödeme_bağlantısı"] },
  fields: {
    subject: "payment_link.subject",
    preheader: "payment_link.preheader",
    heading: "payment_link.heading",
    intro: "payment_link.intro",
    sms: "payment_link.sms",
  },
  values: (vars, brand) => ({
    shop: brand.shopName,
    name: vars.customerName,
    number: vars.number,
    total: vars.total,
    validity: vars.validity,
    url: vars.url,
  }),
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
  editable: EDIT,
  email: (vars, brand, context) => {
    const text = textsFor(EDIT, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
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
    })
  },
  sms: (vars, brand, own) => textsFor(EDIT, vars, brand, own)("sms"),
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

import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A cart whose payment was refused, still there to pay. */
export interface PaymentFailedVars {
  customerName: string
  total: string
  /** The storefront's cart, or null until a domain is set. */
  cartUrl: string | null
}

// Optional: no order was made, the storefront said so at the time (adr/0036 Ek 2026-11-10)
const EDIT: EditSpec<PaymentFailedVars> = {
  group: "order",
  required: false,
  tokens: { mağaza_adı: "shop", müşteri_adı: "name", toplam: "total" },
  fields: {
    subject: "payment_failed.subject",
    preheader: "payment_failed.preheader",
    heading: "payment_failed.heading",
    intro: "payment_failed.intro",
  },
  values: (vars, brand) => ({ shop: brand.shopName, name: vars.customerName, total: vars.total }),
}

/** "Ödemeniz tamamlanamadı": no order was placed; the cart can be paid again. */
export const paymentFailed: MessageTemplate<PaymentFailedVars> = {
  name: "payment.failed",
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
        { kind: "button", label: messageText("payment_failed.button"), url: vars.cartUrl },
        { kind: "note", text: messageText("payment_failed.note") },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    })
  },
  sample: { customerName: "Ayşe", total: "₺389,80", cartUrl: "https://magaza.example/sepet" },
}

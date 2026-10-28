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

/** "Ödemeniz tamamlanamadı": no order was placed; the cart can be paid again. */
export const paymentFailed: MessageTemplate<PaymentFailedVars> = {
  name: "payment.failed",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("payment_failed.subject"),
      preheader: messageText("payment_failed.preheader", { shop: brand.shopName }),
      heading: messageText("payment_failed.heading", { name: vars.customerName }),
      blocks: [
        { kind: "paragraph", text: messageText("payment_failed.intro", { total: vars.total }) },
        { kind: "button", label: messageText("payment_failed.button"), url: vars.cartUrl },
        { kind: "note", text: messageText("payment_failed.note") },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    }),
  sample: { customerName: "Ayşe", total: "₺389,80", cartUrl: "https://magaza.example/sepet" },
}

import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A cart left behind, as its reminder shows it (F10.7). */
export interface CartReminderVars {
  customerName: string
  items: { title: string; detail: string | null; quantity: number; total: string }[]
  /** The storefront's page that opens the cart with the link's token. */
  cartUrl: string | null
  /** How long the link opens the cart. */
  days: number
}

/**
 * "Sepetiniz sizi bekliyor" (F10.7, adr/0038 §1): once per cart left
 * behind. Commercial: only to an address with e-mail consent, with its
 * one-click way out.
 */
export const cartReminder: MessageTemplate<CartReminderVars> = {
  name: "cart.reminder",
  kind: "commercial",
  channels: ["email"],
  // The link's token is only the run's: a lost send is tried by a later run
  retry: false,
  email: (vars, brand, context) =>
    renderEmail(brand, {
      subject: messageText("cart_reminder.subject"),
      preheader: messageText("cart_reminder.preheader", { shop: brand.shopName }),
      heading: messageText("cart_reminder.heading", { name: vars.customerName }),
      blocks: [
        { kind: "paragraph", text: messageText("cart_reminder.intro", { shop: brand.shopName }) },
        { kind: "items", rows: vars.items },
        { kind: "button", label: messageText("cart_reminder.button"), url: vars.cartUrl },
        { kind: "note", text: messageText("cart_reminder.note", { days: vars.days }) },
      ],
      footer: messageText("footer.commercial", {
        shop: brand.shopName,
        contact: brand.contactEmail ?? brand.shopName,
      }),
      unsubscribe: {
        label: messageText("footer.unsubscribe"),
        url: context?.unsubscribeUrl ?? null,
      },
    }),
  sample: {
    customerName: "Ayşe",
    items: [
      { title: "Örnek ürün", detail: "Mavi / M", quantity: 1, total: "₺499,90" },
      { title: "İkinci ürün", detail: null, quantity: 2, total: "₺240,00" },
    ],
    cartUrl: "https://magaza.example/sepet/geri-don?token=ornek",
    days: 7,
  },
}

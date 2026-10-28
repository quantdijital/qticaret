import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** The link to a guest's order, asked for from the storefront (adr/0037 §2). */
export interface OrderLinkVars {
  number: string
  customerName: string
  orderUrl: string
  /** How many days the link opens the order. */
  days: number
}

/**
 * "Siparişinizin bağlantısı": the order's page with its key, to the
 * order's own address only. Whoever asked learns nothing either way.
 */
export const orderLink: MessageTemplate<OrderLinkVars> = {
  name: "order.access_link",
  kind: "transactional",
  channels: ["email"],
  // The loader makes the key again from the order: a retry carries no secret of the event's
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("order_link.subject", { number: vars.number }),
      preheader: messageText("order_link.preheader", { shop: brand.shopName }),
      heading: messageText("order_link.heading", { name: vars.customerName }),
      blocks: [
        {
          kind: "paragraph",
          text: messageText("order_link.intro", {
            number: vars.number,
            days: String(vars.days),
          }),
        },
        { kind: "button", label: messageText("order.view"), url: vars.orderUrl },
        { kind: "note", text: messageText("order_link.ignore") },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    }),
  sample: {
    number: "1042",
    customerName: "Ayşe",
    orderUrl: "https://magaza.example/siparis/order_ornek?token=ornek",
    days: 30,
  },
}

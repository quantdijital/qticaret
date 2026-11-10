import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
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

/** Required: the shopper asked for it, and nothing else opens a guest's order. */
const EDIT: EditSpec<OrderLinkVars> = {
  group: "order",
  required: true,
  tokens: { mağaza_adı: "shop", müşteri_adı: "name", sipariş_no: "number", gün_sayısı: "days" },
  fields: {
    subject: "order_link.subject",
    preheader: "order_link.preheader",
    heading: "order_link.heading",
    intro: "order_link.intro",
  },
  values: (vars, brand) => ({
    shop: brand.shopName,
    name: vars.customerName,
    number: vars.number,
    days: String(vars.days),
  }),
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
  editable: EDIT,
  email: (vars, brand, context) => {
    const text = textsFor(EDIT, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        { kind: "button", label: messageText("order.view"), url: vars.orderUrl },
        { kind: "note", text: messageText("order_link.ignore") },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    })
  },
  sample: {
    number: "1042",
    customerName: "Ayşe",
    orderUrl: "https://magaza.example/siparis/order_ornek?token=ornek",
    days: 30,
  },
}

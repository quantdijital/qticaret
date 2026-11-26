import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A note staff wrote on an order for its customer (Batch 9 / O3). */
export interface OrderNoteVars {
  number: string
  customerName: string
  /** The staff member's words as written: escaped by the layout, line breaks kept. */
  note: string
  /** The order's page; null when the order has no link. */
  orderUrl: string | null
}

/**
 * Sent only when staff choose "Müşteriye gönder" on a note: the shop may
 * turn it off or reword its frame; the note itself is staff's own words.
 */
const EDIT: EditSpec<OrderNoteVars> = {
  group: "order",
  required: false,
  tokens: {
    mağaza_adı: "shop",
    müşteri_adı: "name",
    sipariş_no: "number",
  },
  fields: {
    subject: "order_note.subject",
    preheader: "order_note.preheader",
    heading: "order_note.heading",
    intro: "order_note.intro",
  },
  values: (vars, brand) => ({
    shop: brand.shopName,
    name: vars.customerName,
    number: vars.number,
  }),
}

/** "Siparişinizle ilgili bir not": the shop's note, then the order's page. */
export const orderNote: MessageTemplate<OrderNoteVars> = {
  name: "order.note",
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
        { kind: "paragraph", text: vars.note },
        {
          kind: "button",
          label: messageText("order_note.button"),
          url: vars.orderUrl,
        },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    })
  },
  sample: {
    number: "1042",
    customerName: "Ayşe",
    note: "Siparişinizdeki bıçağın kılıfı yarın depomuza gelecek; siparişiniz cuma günü kargoya verilecek.",
    orderUrl: "https://magaza.example/siparis/order_ornek?token=ornek",
  },
}

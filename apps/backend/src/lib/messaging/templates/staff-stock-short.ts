import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/**
 * "Stok yetersiz sipariş" (adr/0026 Ek 2026-11-06): a paid order placed
 * though the shelf lacked its units, to the staff list beside the bell.
 * The shop makes or buys the units, or cancels and refunds.
 */
export interface StaffStockShortVars {
  number: string
  lines: { title: string; quantity: number; short: number }[]
  /** The order's page in the panel. */
  orderUrl: string
}

export const staffStockShort: MessageTemplate<StaffStockShortVars> = {
  name: "staff.stock_short",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("staff_short.subject", { number: vars.number }),
      preheader: messageText("staff_short.preheader"),
      heading: messageText("staff_short.heading", { number: vars.number }),
      blocks: [
        { kind: "paragraph", text: messageText("staff_short.intro") },
        {
          kind: "details",
          title: messageText("staff_short.lines"),
          lines: vars.lines.map((line) =>
            messageText("staff_short.line", {
              title: line.title,
              short: line.short,
              quantity: line.quantity,
            })
          ),
        },
        { kind: "button", label: messageText("staff_short.button"), url: vars.orderUrl },
      ],
      footer: messageText("footer.staff", { shop: brand.shopName }),
    }),
  sample: {
    number: "1042",
    lines: [{ title: "Örnek ürün / Kahverengi", quantity: 2, short: 1 }],
    orderUrl: "https://magaza.example/orders/order_ornek",
  },
}

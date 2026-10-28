import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { EmailBlock } from "./layout"
import type { MessageTemplate } from "./types"

/** A return or exchange request as its messages show it. */
export interface ReturnVars {
  number: string
  customerName: string
  kind: "return" | "exchange"
  items: { title: string; detail: string | null; quantity: number }[]
  /** The carrier's code the shopper hands the parcel over with, once approved. */
  returnCode: string | null
  /** What was paid back, once refunded. */
  amount: string | null
}

const SAMPLE: ReturnVars = {
  number: "1042",
  customerName: "Ayşe",
  kind: "return",
  items: [{ title: "Örnek ürün", detail: "Mavi / M", quantity: 1 }],
  returnCode: "GLV12345678",
  amount: "₺120,00",
}

const lines = (vars: ReturnVars): EmailBlock => ({
  kind: "details",
  title: messageText("returns.lines"),
  lines: vars.items.map(
    (item) => `${String(item.quantity)} × ${item.title}${item.detail ? ` (${item.detail})` : ""}`
  ),
})

/** A text by the request's kind: "İade" and "Değişim" read differently all through. */
const said = (key: string, vars: ReturnVars, values: Record<string, string> = {}) =>
  messageText(`${key}.${vars.kind}`, { number: vars.number, name: vars.customerName, ...values })

function template(
  name: string,
  key: string,
  body: (vars: ReturnVars) => EmailBlock[]
): MessageTemplate<ReturnVars> {
  return {
    name,
    kind: "transactional",
    channels: ["email"],
    retry: true,
    email: (vars, brand) =>
      renderEmail(brand, {
        subject: said(`${key}.subject`, vars),
        preheader: messageText(`${key}.preheader`, { shop: brand.shopName }),
        heading: said(`${key}.heading`, vars),
        blocks: [{ kind: "paragraph", text: said(`${key}.intro`, vars) }, ...body(vars)],
        footer: messageText("footer.order", { shop: brand.shopName }),
      }),
    sample: SAMPLE,
  }
}

/** "İade/değişim talebiniz alındı": the shop will look at it. */
export const returnRequested = template("return.requested", "return_requested", (vars) => [
  lines(vars),
])

/** "Talebiniz onaylandı": how to send the parcel back. */
export const returnApproved = template("return.approved", "return_approved", (vars) => [
  lines(vars),
  vars.returnCode
    ? {
        kind: "details",
        title: messageText("return_approved.code_title"),
        lines: [messageText("return_approved.code", { code: vars.returnCode })],
      }
    : { kind: "paragraph", text: messageText("return_approved.no_code") },
])

/** "İadeniz yapıldı": what was paid back, and when it shows. */
export const returnRefunded = template("return.refunded", "return_refunded", (vars) => [
  {
    kind: "summary",
    rows: [
      { label: messageText("return_refunded.amount"), value: vars.amount ?? "", strong: true },
    ],
  },
  { kind: "note", text: messageText("return_refunded.when") },
])

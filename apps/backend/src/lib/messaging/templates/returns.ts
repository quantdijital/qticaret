import type { RefusalReason } from "../../orders/withdrawal-rules"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { EmailBlock } from "./layout"
import { contentLines } from "./line-addons"
import type { MessageLineAddons } from "./line-addons"
import type { MessageTemplate } from "./types"

type ReturnLineVars = { title: string; detail: string | null; quantity: number } & MessageLineAddons

/**
 * Units refused at receipt, and why (adr/0032 Ek 2026-11-03): today only
 * a sealed good opened (`unsealed`, MSY md. 15/1-ç).
 */
export type RefusedLineVars = ReturnLineVars & { reason: RefusalReason }

/** A return or exchange request as its messages show it. */
export interface ReturnVars {
  number: string
  customerName: string
  kind: "return" | "exchange"
  items: ReturnLineVars[]
  /** The carrier's code the shopper hands the parcel over with, once approved. */
  returnCode: string | null
  /** What was paid back, once refunded. */
  amount: string | null
  /** Units refused at receipt; none until the parcel is received. */
  refused: RefusedLineVars[]
  /** Units besides the refused ones were taken back: their refund or swap goes on. */
  taken: boolean
}

const SAMPLE: ReturnVars = {
  number: "1042",
  customerName: "Ayşe",
  kind: "return",
  items: [{ title: "Örnek ürün", detail: "Mavi / M", quantity: 1 }],
  returnCode: "GLV12345678",
  amount: "₺120,00",
  refused: [],
  taken: false,
}

const REFUSED_SAMPLE: ReturnVars = {
  ...SAMPLE,
  items: [
    { title: "Örnek ürün", detail: "Mavi / M", quantity: 1 },
    { title: "Örnek bakım ürünü", detail: null, quantity: 1 },
  ],
  amount: null,
  refused: [{ title: "Örnek bakım ürünü", detail: null, quantity: 1, reason: "unsealed" }],
  taken: true,
}

const lines = (vars: ReturnVars): EmailBlock => ({
  kind: "details",
  title: messageText("returns.lines"),
  lines: vars.items.flatMap(contentLines),
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

/**
 * "İadeniz yapıldı": what was paid back, and when it shows; what was
 * refused at receipt is not in it (its own message said so).
 */
export const returnRefunded = template("return.refunded", "return_refunded", (vars) => [
  {
    kind: "summary",
    rows: [
      { label: messageText("return_refunded.amount"), value: vars.amount ?? "", strong: true },
    ],
  },
  ...(vars.refused.length
    ? [{ kind: "note" as const, text: messageText("return_refunded.refused_note") }]
    : []),
  { kind: "note", text: messageText("return_refunded.when") },
])

/**
 * "Kabul edilmeyen ürünler" (adr/0032 Ek 2026-11-03): sent as the parcel
 * is received with units refused, a sealed good opened (MSY md. 15/1-ç).
 * Each unit and why, that its money is not paid back, and that the goods
 * are the shopper's: sent back at the shop's cost or picked up, as they
 * choose. When everything was refused, this is the request's last message.
 */
export const returnRefused: MessageTemplate<ReturnVars> = {
  ...template("return.refused", "return_refused", (vars) => [
    {
      kind: "details",
      title: messageText("return_refused.lines"),
      lines: vars.refused.flatMap((line) => [
        ...contentLines(line),
        messageText(`return_refused.reason.${line.reason}`),
      ]),
    },
    { kind: "paragraph", text: messageText("return_refused.goods") },
    ...(vars.taken ? [{ kind: "note" as const, text: said("return_refused.rest", vars) }] : []),
  ]),
  sample: REFUSED_SAMPLE,
}

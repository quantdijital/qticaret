import type { RefusalReason } from "../../orders/withdrawal-rules"
import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
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
  /**
   * The code the shopper says at the carrier's branch, once approved: the
   * shop's contracted return code (adr/0031 Ek 2026-11-26), or an old
   * request's carrier-made one.
   */
  returnCode: string | null
  /** The carrier that code is with ("Aras Kargo"); null for an old request's own code. */
  returnCarrier?: string | null
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
  returnCode: "48213",
  returnCarrier: "Aras Kargo",
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

/**
 * What the shop may reword (adr/0036 Ek 2026-11-10): one text for both
 * kinds, `{talep_türü}` saying "iade" or "değişim"; the catalog's own
 * reads each kind its way.
 */
const editSpec = (key: string, required: boolean): EditSpec<ReturnVars> => ({
  group: "returns",
  required,
  tokens: { mağaza_adı: "shop", müşteri_adı: "name", sipariş_no: "number", talep_türü: "kind" },
  fields: {
    subject: (vars) => `${key}.subject.${vars.kind}`,
    preheader: `${key}.preheader`,
    heading: (vars) => `${key}.heading.${vars.kind}`,
    intro: (vars) => `${key}.intro.${vars.kind}`,
  },
  values: (vars, brand) => ({
    shop: brand.shopName,
    name: vars.customerName,
    number: vars.number,
    kind: messageText(`returns.kind.${vars.kind}`),
  }),
})

function template(
  name: string,
  key: string,
  required: boolean,
  body: (vars: ReturnVars) => EmailBlock[]
): MessageTemplate<ReturnVars> {
  const edit = editSpec(key, required)
  return {
    name,
    kind: "transactional",
    channels: ["email"],
    retry: true,
    editable: edit,
    email: (vars, brand, context) => {
      const text = textsFor(edit, vars, brand, context?.own)
      return renderEmail(brand, {
        subject: text("subject"),
        preheader: text("preheader"),
        heading: text("heading"),
        blocks: [{ kind: "paragraph", text: text("intro") }, ...body(vars)],
        footer: messageText("footer.order", { shop: brand.shopName }),
      })
    },
    sample: SAMPLE,
  }
}

/** "İade/değişim talebiniz alındı": the shop will look at it. */
export const returnRequested = template("return.requested", "return_requested", false, (vars) => [
  lines(vars),
])

/**
 * How to send the parcel back: with the shop's contracted return code, the
 * carrier's branch and the code to say, free of charge; with an old
 * request's own code, the code; with none, that the shop will be in touch.
 */
export function returnCodeBlock(
  vars: Pick<ReturnVars, "returnCode" | "returnCarrier">
): EmailBlock {
  if (!vars.returnCode) {
    return { kind: "paragraph", text: messageText("return_approved.no_code") }
  }
  return {
    kind: "details",
    title: messageText("return_approved.code_title"),
    lines: [
      vars.returnCarrier
        ? messageText("return_approved.contracted", {
            carrier: vars.returnCarrier,
            code: vars.returnCode,
          })
        : messageText("return_approved.code", { code: vars.returnCode }),
    ],
  }
}

/** "Talebiniz onaylandı": how to send the parcel back. */
export const returnApproved = template("return.approved", "return_approved", true, (vars) => [
  lines(vars),
  returnCodeBlock(vars),
])

/**
 * "İadeniz yapıldı": what was paid back, and when it shows; what was
 * refused at receipt is not in it (its own message said so).
 */
export const returnRefunded = template("return.refunded", "return_refunded", false, (vars) => [
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
 * "Talebiniz iptal edildi": staff took an approval back before anything
 * came back (order #691). The parcel is not to be sent (the contracted
 * return code stays valid shop-wide, so it is not called invalid),
 * and a new request may be made within the period. Staff's reason is
 * the team's, never in it.
 */
export const returnCanceled = template("return.canceled", "return_canceled", false, (vars) => [
  lines(vars),
  { kind: "note", text: messageText("return_canceled.again") },
])

/**
 * "Kabul edilmeyen ürünler" (adr/0032 Ek 2026-11-03): sent as the parcel
 * is received with units refused, a sealed good opened (MSY md. 15/1-ç).
 * Each unit and why, that its money is not paid back, and that the goods
 * are the shopper's: sent back at the shop's cost or picked up, as they
 * choose. When everything was refused, this is the request's last message.
 */
export const returnRefused: MessageTemplate<ReturnVars> = {
  ...template("return.refused", "return_refused", true, (vars) => [
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

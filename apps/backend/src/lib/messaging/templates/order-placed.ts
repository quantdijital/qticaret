import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { EmailBlock } from "./layout"
import { addonLines } from "./line-addons"
import type { MessageLineAddons } from "./line-addons"
import type { MessageTemplate } from "./types"

/** An order as its messages show it: amounts already written out in lira. */
export interface OrderVars {
  number: string
  customerName: string
  items: ({
    title: string
    detail: string | null
    quantity: number
    total: string
  } & MessageLineAddons)[]
  subtotal: string
  shipping: string
  discount: string | null
  total: string
  payment: "card" | "bank_transfer" | "cash_on_delivery"
  /** The shop's account for a bank transfer, with when it must arrive. */
  bank: { holder: string; bank: string; iban: string; deadline: string | null } | null
  address: string[]
  /**
   * False: nothing in the order ships (digital and service lines, a gift
   * card; adr/0076 §6), so no shipping row and no delivery address.
   * Absent or true: both, as before.
   */
  ships?: boolean
  orderUrl: string | null
  /** The order keeps the contracts the shopper accepted (F13.2); its page shows them. */
  contracts: boolean
}

export function orderSummary(vars: OrderVars): EmailBlock[] {
  const ships = vars.ships !== false
  return [
    {
      kind: "items",
      rows: vars.items.map((item) => ({ ...item, lines: addonLines(item) })),
    },
    {
      kind: "summary",
      rows: [
        { label: messageText("order.subtotal"), value: vars.subtotal },
        ...(ships ? [{ label: messageText("order.shipping"), value: vars.shipping }] : []),
        ...(vars.discount ? [{ label: messageText("order.discount"), value: vars.discount }] : []),
        { label: messageText("order.total"), value: vars.total, strong: true },
      ],
    },
    ...(ships
      ? [{ kind: "details" as const, title: messageText("order.address"), lines: vars.address }]
      : []),
  ]
}

function paymentBlocks(vars: OrderVars): EmailBlock[] {
  if (vars.payment === "cash_on_delivery") {
    return [{ kind: "paragraph", text: messageText("order_placed.cod", { total: vars.total }) }]
  }
  if (vars.payment !== "bank_transfer" || !vars.bank) {
    return []
  }
  return [
    { kind: "paragraph", text: messageText("order_placed.bank_transfer", { total: vars.total }) },
    {
      kind: "details",
      title: messageText("bank.title"),
      lines: [
        messageText("bank.holder", { holder: vars.bank.holder }),
        messageText("bank.bank", { bank: vars.bank.bank }),
        messageText("bank.iban", { iban: vars.bank.iban }),
        messageText("bank.reference", { number: vars.number }),
      ],
    },
    ...(vars.bank.deadline
      ? [
          {
            kind: "note" as const,
            text: messageText("order_placed.bank_deadline", { deadline: vars.bank.deadline }),
          },
        ]
      : []),
  ]
}

/**
 * The confirmation the law asks for (6502 md. 48/4, MSY md. 9): required,
 * reworded but never turned off (adr/0036 Ek 2026-11-10).
 */
const EDIT: EditSpec<OrderVars> = {
  group: "order",
  required: true,
  tokens: { mağaza_adı: "shop", müşteri_adı: "name", sipariş_no: "number", toplam: "total" },
  fields: {
    subject: "order_placed.subject",
    preheader: "order_placed.preheader",
    heading: "order_placed.heading",
    // An order nothing ships for is never "handed to the carrier" (adr/0076 §6)
    intro: (vars) => (vars.ships === false ? "order_placed.intro_unshipped" : "order_placed.intro"),
    sms: "order_placed.sms",
  },
  values: (vars, brand) => ({
    shop: brand.shopName,
    name: vars.customerName,
    number: vars.number,
    total: vars.total,
  }),
}

/** "Siparişiniz alındı": card, bank transfer awaited, or paid at the door. */
export const orderPlaced: MessageTemplate<OrderVars> = {
  name: "order.placed",
  kind: "transactional",
  channels: ["email", "sms"],
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
        ...paymentBlocks(vars),
        ...orderSummary(vars),
        { kind: "button", label: messageText("order.view"), url: vars.orderUrl },
        ...(vars.contracts && vars.orderUrl
          ? [{ kind: "note" as const, text: messageText("order_placed.contracts") }]
          : []),
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    })
  },
  sms: (vars, brand, own) => textsFor(EDIT, vars, brand, own)("sms"),
  sample: {
    number: "1042",
    customerName: "Ayşe",
    items: [
      { title: "Örnek ürün", detail: "Mavi / M", quantity: 2, total: "₺240,00" },
      { title: "İkinci ürün", detail: null, quantity: 1, total: "₺89,90" },
    ],
    subtotal: "₺329,90",
    shipping: "₺59,90",
    discount: null,
    total: "₺389,80",
    payment: "bank_transfer",
    bank: {
      holder: "Örnek Ticaret Ltd. Şti.",
      bank: "Örnek Bank",
      iban: "TR00 0000 0000 0000 0000 0000 00",
      deadline: "30 Ekim 2026 18:00",
    },
    address: ["Ayşe Yılmaz", "Moda Mah., Atatürk Cad. No: 5", "Kadıköy / İstanbul"],
    orderUrl: null,
    contracts: true,
  },
}

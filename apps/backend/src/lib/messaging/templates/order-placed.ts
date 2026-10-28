import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { EmailBlock } from "./layout"
import type { MessageTemplate } from "./types"

/** An order as its messages show it: amounts already written out in lira. */
export interface OrderVars {
  number: string
  customerName: string
  items: { title: string; detail: string | null; quantity: number; total: string }[]
  subtotal: string
  shipping: string
  discount: string | null
  total: string
  payment: "card" | "bank_transfer" | "cash_on_delivery"
  /** The shop's account for a bank transfer, with when it must arrive. */
  bank: { holder: string; bank: string; iban: string; deadline: string | null } | null
  address: string[]
  orderUrl: string | null
}

export function orderSummary(vars: OrderVars): EmailBlock[] {
  return [
    { kind: "items", rows: vars.items },
    {
      kind: "summary",
      rows: [
        { label: messageText("order.subtotal"), value: vars.subtotal },
        { label: messageText("order.shipping"), value: vars.shipping },
        ...(vars.discount ? [{ label: messageText("order.discount"), value: vars.discount }] : []),
        { label: messageText("order.total"), value: vars.total, strong: true },
      ],
    },
    { kind: "details", title: messageText("order.address"), lines: vars.address },
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

/** "Siparişiniz alındı": card, bank transfer awaited, or paid at the door. */
export const orderPlaced: MessageTemplate<OrderVars> = {
  name: "order.placed",
  kind: "transactional",
  channels: ["email", "sms"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("order_placed.subject", { number: vars.number }),
      preheader: messageText("order_placed.preheader", { shop: brand.shopName }),
      heading: messageText("order_placed.heading", { name: vars.customerName }),
      blocks: [
        { kind: "paragraph", text: messageText("order_placed.intro", { number: vars.number }) },
        ...paymentBlocks(vars),
        ...orderSummary(vars),
        { kind: "button", label: messageText("order.view"), url: vars.orderUrl },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    }),
  sms: (vars, brand) =>
    messageText("order_placed.sms", {
      shop: brand.shopName,
      number: vars.number,
      total: vars.total,
    }),
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
  },
}

import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A parcel as its messages show it. */
export interface ParcelVars {
  number: string
  customerName: string
  /** The carrier's name, or null for the shop's own delivery. */
  carrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  /** What the parcel holds: its lines, without prices. */
  items: { title: string; detail: string | null; quantity: number }[]
}

const SAMPLE: ParcelVars = {
  number: "1042",
  customerName: "Ayşe",
  carrier: "Aras Kargo",
  trackingNumber: "1234567890",
  trackingUrl: "https://kargotakip.araskargo.com.tr/mainpage.aspx?code=1234567890",
  items: [{ title: "Örnek ürün", detail: "Mavi / M", quantity: 2 }],
}

const contents = (vars: ParcelVars) => ({
  kind: "details" as const,
  title: messageText("parcel.contents"),
  lines: vars.items.map(
    (item) => `${String(item.quantity)} × ${item.title}${item.detail ? ` (${item.detail})` : ""}`
  ),
})

function trackingLines(vars: ParcelVars): string[] {
  return [
    vars.carrier ? messageText("parcel.carrier", { carrier: vars.carrier }) : null,
    vars.trackingNumber ? messageText("parcel.tracking", { number: vars.trackingNumber }) : null,
  ].filter((line): line is string => line !== null)
}

/** "Siparişiniz kargoya verildi", with the carrier and where to follow it. */
export const orderShipped: MessageTemplate<ParcelVars> = {
  name: "order.shipped",
  kind: "transactional",
  channels: ["email", "sms"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("order_shipped.subject", { number: vars.number }),
      preheader: messageText("order_shipped.preheader", { shop: brand.shopName }),
      heading: messageText("order_shipped.heading", { name: vars.customerName }),
      blocks: [
        { kind: "paragraph", text: messageText("order_shipped.intro", { number: vars.number }) },
        ...(trackingLines(vars).length > 0
          ? [
              {
                kind: "details" as const,
                title: messageText("parcel.title"),
                lines: trackingLines(vars),
              },
            ]
          : []),
        { kind: "button", label: messageText("parcel.follow"), url: vars.trackingUrl },
        contents(vars),
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    }),
  sms: (vars, brand) =>
    messageText(vars.trackingUrl ? "order_shipped.sms_link" : "order_shipped.sms", {
      shop: brand.shopName,
      number: vars.number,
      carrier: vars.carrier ?? brand.shopName,
      url: vars.trackingUrl ?? "",
    }),
  sample: SAMPLE,
}

/** "Siparişiniz teslim edildi", and how to return something. */
export const orderDelivered: MessageTemplate<ParcelVars> = {
  name: "order.delivered",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  email: (vars, brand) =>
    renderEmail(brand, {
      subject: messageText("order_delivered.subject", { number: vars.number }),
      preheader: messageText("order_delivered.preheader", { shop: brand.shopName }),
      heading: messageText("order_delivered.heading", { name: vars.customerName }),
      blocks: [
        { kind: "paragraph", text: messageText("order_delivered.intro", { number: vars.number }) },
        contents(vars),
        { kind: "note", text: messageText("order_delivered.returns") },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    }),
  sample: SAMPLE,
}

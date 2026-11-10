import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import { contentLines } from "./line-addons"
import type { MessageLineAddons } from "./line-addons"
import type { MessageTemplate } from "./types"

/** A parcel as its messages show it. */
export interface ParcelVars {
  number: string
  customerName: string
  /** The carrier's name, or null for the shop's own delivery. */
  carrier: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  /** What the parcel holds: its lines, without prices, each with its add-on picks. */
  items: ({ title: string; detail: string | null; quantity: number } & MessageLineAddons)[]
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
  lines: vars.items.flatMap(contentLines),
})

function trackingLines(vars: ParcelVars): string[] {
  return [
    vars.carrier ? messageText("parcel.carrier", { carrier: vars.carrier }) : null,
    vars.trackingNumber ? messageText("parcel.tracking", { number: vars.trackingNumber }) : null,
  ].filter((line): line is string => line !== null)
}
const TOKENS = {
  mağaza_adı: "shop",
  müşteri_adı: "name",
  sipariş_no: "number",
} as const

const parcelValues = (vars: ParcelVars, shop: string) => ({
  shop,
  name: vars.customerName,
  number: vars.number,
  carrier: vars.carrier ?? shop,
  tracking: vars.trackingNumber ?? "",
  url: vars.trackingUrl ?? "",
})

// Optional: the order's confirmation already went (adr/0036 Ek 2026-11-10)
const SHIPPED: EditSpec<ParcelVars> = {
  group: "shipping",
  required: false,
  tokens: {
    ...TOKENS,
    kargo_firması: "carrier",
    takip_no: "tracking",
    takip_bağlantısı: "url",
  },
  fields: {
    subject: "order_shipped.subject",
    preheader: "order_shipped.preheader",
    heading: "order_shipped.heading",
    intro: "order_shipped.intro",
    sms: (vars) => (vars.trackingUrl ? "order_shipped.sms_link" : "order_shipped.sms"),
  },
  values: (vars, brand) => parcelValues(vars, brand.shopName),
}

const DELIVERED: EditSpec<ParcelVars> = {
  group: "shipping",
  required: false,
  tokens: TOKENS,
  fields: {
    subject: "order_delivered.subject",
    preheader: "order_delivered.preheader",
    heading: "order_delivered.heading",
    intro: "order_delivered.intro",
  },
  values: (vars, brand) => parcelValues(vars, brand.shopName),
}

/** "Siparişiniz kargoya verildi", with the carrier and where to follow it. */
export const orderShipped: MessageTemplate<ParcelVars> = {
  name: "order.shipped",
  kind: "transactional",
  channels: ["email", "sms"],
  retry: true,
  editable: SHIPPED,
  email: (vars, brand, context) => {
    const text = textsFor(SHIPPED, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        ...(trackingLines(vars).length > 0
          ? [
              {
                kind: "details" as const,
                title: messageText("parcel.title"),
                lines: trackingLines(vars),
              },
            ]
          : []),
        {
          kind: "button",
          label: messageText("parcel.follow"),
          url: vars.trackingUrl,
        },
        contents(vars),
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    })
  },
  sms: (vars, brand, own) => textsFor(SHIPPED, vars, brand, own)("sms"),
  sample: SAMPLE,
}

/** "Siparişiniz teslim edildi", and how to return something. */
export const orderDelivered: MessageTemplate<ParcelVars> = {
  name: "order.delivered",
  kind: "transactional",
  channels: ["email"],
  retry: true,
  editable: DELIVERED,
  email: (vars, brand, context) => {
    const text = textsFor(DELIVERED, vars, brand, context?.own)
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks: [
        { kind: "paragraph", text: text("intro") },
        contents(vars),
        { kind: "note", text: messageText("order_delivered.returns") },
      ],
      footer: messageText("footer.order", { shop: brand.shopName }),
    })
  },
  sample: SAMPLE,
}

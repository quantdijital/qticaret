import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { MessageTemplate } from "./types"

/** A commercial message the shop writes (a campaign, F10): sent only with consent. */
export interface AnnouncementVars {
  title: string
  body: string
  /** Where the button leads on the storefront; null for none. */
  url: string | null
}

/** A line the SMS runs into the next one: ends with a full stop unless it has its own. */
const sentence = (text: string): string => {
  const trimmed = text.trim()
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * A shop's announcement (F9.5): commercial, so it goes only to recipients
 * who consented on the channel, and says how to stop them (İYS).
 */
export const announcement: MessageTemplate<AnnouncementVars> = {
  name: "marketing.announcement",
  kind: "commercial",
  channels: ["email", "sms"],
  retry: false,
  email: (vars, brand, context) =>
    renderEmail(brand, {
      subject: vars.title,
      preheader: vars.title,
      heading: vars.title,
      blocks: [
        { kind: "paragraph", text: vars.body },
        { kind: "button", label: messageText("announcement.button"), url: vars.url },
      ],
      footer: messageText("footer.commercial", {
        shop: brand.shopName,
        contact: brand.contactEmail ?? brand.shopName,
      }),
      unsubscribe: {
        label: messageText("footer.unsubscribe"),
        url: context?.unsubscribeUrl ?? null,
      },
    }),
  sms: (vars, brand) =>
    messageText("announcement.sms", {
      shop: brand.shopName,
      title: sentence(vars.title),
      body: sentence(vars.body),
    }),
  sample: {
    title: "Hafta sonuna özel %20 indirim",
    body: "Seçili ürünlerde pazar gecesine kadar sepette %20 indirim.",
    url: null,
  },
}

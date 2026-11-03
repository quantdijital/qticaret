import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { EmailBlock } from "./layout"
import type { MessageTemplate } from "./types"

/**
 * A bulk message as one recipient gets it (adr/0050 §4), made by the
 * campaign's loader: the shop's details and the recipient's name filled
 * in, links with the campaign's utm, product prices read at send time.
 */
export interface CampaignVars {
  subject: string
  preheader: string
  blocks: EmailBlock[]
  /** The shop's title and MERSİS number (the `legal` settings); null while unset. */
  legal: string | null
  /** The text as it goes: the shop's name and the way to refuse already at its end. */
  sms: string
  /** A test send to the staff member themselves: marked so. */
  test: boolean
}

/**
 * `marketing.campaign` (adr/0050): commercial, so deliver() sends it only
 * with consent on the channel, and the e-mail carries its one-click way
 * out. A failed send may be tried again: the loader reads the campaign
 * and the recipient from their ids.
 */
export const campaignMessage: MessageTemplate<CampaignVars> = {
  name: "marketing.campaign",
  kind: "commercial",
  channels: ["email", "sms"],
  retry: true,
  email: (vars, brand, context) =>
    renderEmail(brand, {
      subject: vars.test
        ? messageText("campaign.test_subject", { subject: vars.subject })
        : vars.subject,
      preheader: vars.preheader,
      heading: "",
      blocks: vars.blocks,
      footer: [
        messageText("footer.commercial", {
          shop: brand.shopName,
          contact: brand.contactEmail ?? brand.shopName,
        }),
        vars.legal,
      ]
        .filter(Boolean)
        .join(" "),
      unsubscribe: {
        label: messageText("footer.unsubscribe"),
        url: context?.unsubscribeUrl ?? null,
      },
    }),
  sms: (vars) => (vars.test ? messageText("campaign.test_sms", { text: vars.sms }) : vars.sms),
  sample: {
    subject: "Hafta sonuna özel %20 indirim",
    preheader: "Seçili ürünlerde pazar gecesine kadar sepette %20 indirim.",
    blocks: [
      { kind: "heading", text: "Merhaba Ayşe," },
      {
        kind: "rich",
        runs: [
          { text: "Seçili ürünlerde " },
          { text: "pazar gecesine kadar", bold: true },
          { text: " sepette %20 indirim." },
        ],
      },
      {
        kind: "products",
        cards: [
          {
            title: "Örnek ürün",
            url: null,
            image: null,
            price: "₺399,90",
            before: "₺499,90",
          },
        ],
      },
    ],
    legal: "Örnek Ticaret Ltd. Şti. · MERSİS 0123456789000015",
    sms: "Hafta sonuna özel %20 indirim! Örnek Mağaza. Ret için ORNEK yazıp 0000'e gönderin.",
    test: false,
  },
}

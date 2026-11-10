import { textsFor } from "../editable/texts"
import type { EditSpec } from "../editable/types"
import { messageText } from "../texts"
import { renderEmail } from "./layout"
import type { EmailBlock } from "./layout"
import type { MessageTemplate } from "./types"

/** A sold gift card's e-mail to its recipient (adr/0025 Ek 2026-11-03). */
export interface GiftCardVars {
  /** As the buyer typed them, checked again: plain, short, nothing that reads as a link. */
  recipientName: string | null
  senderName: string | null
  message: string | null
  /** The line's cards: one per unit bought, each with its full code and value. */
  cards: { code: string; value: string }[]
  shopUrl: string | null
}

/** Required: the card is what the buyer paid for; this message delivers it. */
const EDIT: EditSpec<GiftCardVars> = {
  group: "order",
  required: true,
  tokens: { mağaza_adı: "shop", alıcı_adı: "name", gönderen_adı: "sender" },
  fields: {
    subject: (vars) => (vars.senderName ? "gift_card.subject_from" : "gift_card.subject"),
    preheader: "gift_card.preheader",
    heading: "gift_card.heading",
    intro: (vars) => (vars.senderName ? "gift_card.intro_from" : "gift_card.intro"),
  },
  values: (vars, brand) => ({
    shop: brand.shopName,
    name: vars.recipientName ?? messageText("gift_card.greeting"),
    sender: vars.senderName ?? "",
  }),
}

/**
 * "Size bir hediye kartı var": the codes, their value, who sent them and
 * their words, and how to spend them. Transactional: the buyer's contract
 * is to deliver the card. The code is in the e-mail only; Medusa keeps no
 * message text (docs/kvkk-envanter.md).
 */
export const giftCardIssued: MessageTemplate<GiftCardVars> = {
  name: "gift_card.issued",
  kind: "transactional",
  channels: ["email"],
  // The loader reads the codes again from the cards: a retry carries nothing of the event's
  retry: true,
  editable: EDIT,
  email: (vars, brand, context) => {
    const shop = brand.shopName
    const text = textsFor(EDIT, vars, brand, context?.own)
    const blocks: EmailBlock[] = [
      { kind: "paragraph", text: text("intro") },
      ...(vars.message
        ? [
            {
              kind: "details" as const,
              title: messageText("gift_card.message"),
              lines: [vars.message],
            },
          ]
        : []),
      ...vars.cards.map((card) => ({
        kind: "details" as const,
        title: messageText("gift_card.card", { value: card.value }),
        lines: [card.code],
      })),
      { kind: "paragraph", text: messageText("gift_card.how_to") },
      { kind: "button", label: messageText("gift_card.shop"), url: vars.shopUrl },
      { kind: "note", text: messageText("gift_card.keep_safe") },
    ]
    return renderEmail(brand, {
      subject: text("subject"),
      preheader: text("preheader"),
      heading: text("heading"),
      blocks,
      footer: messageText("footer.gift_card", { shop }),
    })
  },
  sample: {
    recipientName: "Zeynep",
    senderName: "Ayşe",
    message: "Doğum günün kutlu olsun!",
    cards: [{ code: "GIFT-ABCD-EFGH-JKLM-NPQR", value: "₺500,00" }],
    shopUrl: "https://magaza.example",
  },
}

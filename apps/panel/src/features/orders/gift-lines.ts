/**
 * A gift card line of an order (adr/0025 Ek 2026-11-03): the server writes
 * its recipient in `metadata.qt_gift` at checkout and, once paid, the cards
 * it issued in `metadata.qt_gift_cards` (id and last four characters, never
 * the code). A customer's erasure request removes the recipient; the cards
 * stay.
 */

export interface IssuedGiftCard {
  id: string
  last4: string
}

export interface GiftRecipient {
  email: string
  name: string | null
}

export interface GiftLine {
  recipient: GiftRecipient | null
  cards: IssuedGiftCard[]
}

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null

function recipientOf(gift: unknown): GiftRecipient | null {
  if (!isRow(gift)) {
    return null
  }
  const email = text(gift["recipient_email"])
  return email ? { email, name: text(gift["recipient_name"]) } : null
}

function cardsOf(issued: unknown): IssuedGiftCard[] {
  if (!Array.isArray(issued)) {
    return []
  }
  return issued.flatMap((card: unknown) => {
    if (!isRow(card)) {
      return []
    }
    const id = text(card["id"])
    const last4 = text(card["last4"])
    return id && last4 ? [{ id, last4 }] : []
  })
}

/** What a line's metadata says of its gift cards; null for a line that is not one. */
export function giftLineOf(metadata: unknown): GiftLine | null {
  if (!isRow(metadata)) {
    return null
  }
  const recipient = recipientOf(metadata["qt_gift"])
  const cards = cardsOf(metadata["qt_gift_cards"])
  return recipient || cards.length > 0 ? { recipient, cards } : null
}

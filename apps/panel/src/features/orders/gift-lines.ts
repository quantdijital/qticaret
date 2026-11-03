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

/**
 * Whether the line was sold as a gift card, as the server tells it
 * (`soldAsGiftCard`): its recipient or its cards recorded, even once an
 * erasure left only `{ erased: true }` of the recipient.
 */
export const soldAsGiftCard = (metadata: unknown): boolean =>
  isRow(metadata) && ("qt_gift" in metadata || "qt_gift_cards" in metadata)

/**
 * What an order's cancel does to its gift cards (adr/0025 Ek 2026-11-03):
 * `issued`, cards were made (voided when all are untouched, the cancel
 * refused once one was spent); `pending`, none yet (none will be); null,
 * no gift card line.
 */
export function orderGiftCards(
  items: readonly ({ metadata?: unknown } | null | undefined)[] | null | undefined
): "issued" | "pending" | null {
  const gifts = (items ?? []).filter((item) => item && soldAsGiftCard(item.metadata))
  if (gifts.length === 0) {
    return null
  }
  return gifts.some((item) => (giftLineOf(item?.metadata)?.cards.length ?? 0) > 0)
    ? "issued"
    : "pending"
}

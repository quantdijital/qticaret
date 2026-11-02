import { normalizeRecipient } from "../messaging/recipients"
import { isCleanText } from "../security/text"
import { readsAsLink } from "../text/link-like"

/**
 * Selling gift cards (adr/0025 Ek 2026-11-03): the rules on a gift line,
 * pure so they are tested on their own. A gift line is a cart or order
 * line of a product marked `is_gift_card`; its recipient sits in the
 * line's `metadata.qt_gift` (the server alone writes `qt_` keys), and once
 * paid, the cards it issued in `metadata.qt_gift_cards`: ids and last four
 * characters, never a code.
 */

export const GIFT_RECIPIENT_KEY = "qt_gift"
export const GIFT_CARDS_KEY = "qt_gift_cards"

export const GIFT_MESSAGE_MAX = 300
export const GIFT_NAME_MAX = 60

export interface GiftRecipient {
  recipient_email: string
  recipient_name: string | null
  message: string | null
  sender_name: string | null
}

export interface IssuedCard {
  id: string
  last4: string
}

// Invisible and direction-changing characters: they disguise text in an e-mail sent in the shop's name
const FORMAT_CHARACTER = /\p{Cf}/u

/** Free text as a gift e-mail may carry it: one line, plain, no link or address in it. */
export const plainGiftText = (text: string): string => text.replace(/\s+/gu, " ").trim()

export type GiftTextProblem = "gift_card.text_invalid" | "gift_card.text_link"

/** Why typed text cannot travel in the shop's e-mail to a stranger, or null. */
export function giftTextProblem(text: string): GiftTextProblem | null {
  if (!isCleanText(text) || FORMAT_CHARACTER.test(text)) {
    return "gift_card.text_invalid"
  }
  return readsAsLink(text) ? "gift_card.text_link" : null
}

type Row = Record<string, unknown>

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const textOr = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const text = plainGiftText(value)
  return text !== "" && text.length <= max && giftTextProblem(text) === null ? text : null
}

/** The recipient a line's metadata names, read as strictly as it was written; null without one. */
export function giftRecipientOf(metadata: unknown): GiftRecipient | null {
  const gift = isRow(metadata) ? metadata[GIFT_RECIPIENT_KEY] : undefined
  if (!isRow(gift) || typeof gift["recipient_email"] !== "string") {
    return null
  }
  const email = normalizeRecipient("email", gift["recipient_email"])
  if (!email) {
    return null
  }
  return {
    recipient_email: email,
    recipient_name: textOr(gift["recipient_name"], GIFT_NAME_MAX),
    message: textOr(gift["message"], GIFT_MESSAGE_MAX),
    sender_name: textOr(gift["sender_name"], GIFT_NAME_MAX),
  }
}

/** The cards an order line records as issued. */
export function issuedCardsOf(metadata: unknown): IssuedCard[] {
  const cards = isRow(metadata) ? metadata[GIFT_CARDS_KEY] : undefined
  return Array.isArray(cards)
    ? cards.flatMap((card) =>
        isRow(card) && typeof card["id"] === "string" && typeof card["last4"] === "string"
          ? [{ id: card["id"], last4: card["last4"] }]
          : []
      )
    : []
}

/** What a line records of a card: enough for staff to find it, never enough to spend it. */
export const last4 = (code: string): string => code.slice(-4)

export interface GiftCartLine {
  id: string
  product_id: string | null
  metadata: unknown
}

export interface GiftCartFacts {
  lines: readonly GiftCartLine[]
  /** The products marked as gift cards among the cart's. */
  giftProducts: ReadonlySet<string>
  /** The cart holds gift card or store credit lines (the loyalty plugin's credit lines). */
  hasCredit: boolean
  /** The way to pay being started, or null at completion (`credit`: nothing left to pay). */
  way: string | null
  /** The shop's `promotions.gift_cards` flag. */
  saleOn: boolean
}

export interface GiftLineProblem {
  key:
    "gift_card.sale_disabled" | "gift_card.recipient_required" | "gift_card.not_payable_with_credit"
  field: "items" | "gift_cards" | "provider_id"
}

export const isGiftLine = (line: GiftCartLine, giftProducts: ReadonlySet<string>): boolean =>
  line.product_id !== null && giftProducts.has(line.product_id)

/**
 * Why a cart holding gift lines may not be paid, or null. The shop's
 * cards must be on (a card sold while they are off could not be spent);
 * every gift line names its recipient; and a gift card is never paid with
 * gift cards or store credit, as Shopify does it: a card would buy a card,
 * money laundered through the shop's ledger.
 */
export function giftLineProblem(facts: GiftCartFacts): GiftLineProblem | null {
  const gifts = facts.lines.filter((line) => isGiftLine(line, facts.giftProducts))
  if (gifts.length === 0) {
    return null
  }
  if (!facts.saleOn) {
    return { key: "gift_card.sale_disabled", field: "items" }
  }
  if (facts.way === "credit") {
    return { key: "gift_card.not_payable_with_credit", field: "provider_id" }
  }
  if (facts.hasCredit) {
    return { key: "gift_card.not_payable_with_credit", field: "gift_cards" }
  }
  if (gifts.some((line) => giftRecipientOf(line.metadata) === null)) {
    return { key: "gift_card.recipient_required", field: "items" }
  }
  return null
}

/** One card's idempotency key: its order, its line, its place among the line's units. */
export const giftIssueKey = (orderId: string, lineId: string, index: number): string =>
  `${orderId}:${lineId}:${String(index)}`

export interface GiftOrderLine {
  id: string
  quantity: number
  /** One unit's price, in kuruş: the card's value. */
  unit_kurus: number
  gift: boolean
  /** Cards already issued for the line (found by the line, whatever its metadata says). */
  issued: number
}

export interface GiftOrderFacts {
  order_id: string
  canceled: boolean
  /** Paid in a provider's test mode: no money moved. */
  test_mode: boolean
  /** In kuruş: what the payments must cover (the net less credit), took, and gave back. */
  due: number
  paid: number
  refunded: number
  lines: readonly GiftOrderLine[]
}

export interface GiftUnit {
  line_id: string
  index: number
  value_kurus: number
  key: string
}

export type GiftIssuePlan =
  | { state: "none" | "canceled" | "test_mode" | "unpaid" | "refunded" | "issued" }
  | { state: "issue"; units: GiftUnit[] }

/**
 * What issuing does for an order now. Nothing without gift lines; nothing
 * for a canceled order, one paid in test mode, or one whose payments do
 * not yet cover it (a bank transfer awaited: `payment.captured` comes
 * later). Money given back before the cards went out stops them; once
 * issued, a card is the recipient's. Otherwise each unit still missing,
 * counted by the cards its line already has: a run again issues nothing twice.
 */
export function giftIssuePlan(facts: GiftOrderFacts): GiftIssuePlan {
  const gifts = facts.lines.filter((line) => line.gift)
  if (gifts.length === 0) {
    return { state: "none" }
  }
  const units = gifts.flatMap((line) =>
    Array.from({ length: Math.max(line.quantity - line.issued, 0) }, (_, offset) => {
      const index = line.issued + offset
      return {
        line_id: line.id,
        index,
        value_kurus: line.unit_kurus,
        key: giftIssueKey(facts.order_id, line.id, index),
      }
    })
  )
  if (units.length === 0) {
    return { state: "issued" }
  }
  if (facts.canceled) {
    return { state: "canceled" }
  }
  if (facts.test_mode) {
    return { state: "test_mode" }
  }
  if (facts.paid < facts.due || facts.due <= 0) {
    return { state: "unpaid" }
  }
  if (facts.refunded > 0) {
    return { state: "refunded" }
  }
  return { state: "issue", units }
}

/**
 * A line's metadata with its recipient's personal data gone (KVKK
 * erasure): the cards it issued stay, for the books and the staff.
 */
export function withoutRecipient(metadata: unknown): Row | null {
  if (!isRow(metadata) || !(GIFT_RECIPIENT_KEY in metadata)) {
    return null
  }
  return { ...metadata, [GIFT_RECIPIENT_KEY]: { erased: true } }
}

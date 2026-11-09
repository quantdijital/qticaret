import { likeLiteral } from "../db/like"
import { normalizeCode } from "./code"

/** Where a card stands for the panel's list (adr/0025): spendable, spent, or past its day. */
export const GIFT_CARD_STATES = ["active", "used", "expired"] as const
export type GiftCardState = (typeof GIFT_CARD_STATES)[number]

export interface ListedCard {
  value?: number | string | null
  expires_at?: string | Date | null
  store_credit_account?: { balance?: number | string | null } | null
}

/** What is left on a card; before its account is made, its value. */
export const cardBalance = (card: ListedCard): number =>
  Number(card.store_credit_account?.balance ?? card.value ?? 0)

/** A card with a last day passed is expired whatever is left; else spent at zero. */
export function cardState(card: ListedCard, now = new Date()): GiftCardState {
  if (card.expires_at && new Date(card.expires_at).getTime() <= now.getTime()) {
    return "expired"
  }
  return cardBalance(card) > 0 ? "active" : "used"
}

/**
 * The code filter a search gives: the code as stored (`normalizeCode`),
 * matched from its start, so the whole code finds that card and its first
 * characters (`GIFT-7K`) every card that starts so. Null for no search.
 */
export function codeFilter(q: string | undefined): { $like: string } | null {
  const code = normalizeCode(q ?? "").replace(/\s+/gu, "")
  return code === "" ? null : { $like: `${likeLiteral(code)}%` }
}

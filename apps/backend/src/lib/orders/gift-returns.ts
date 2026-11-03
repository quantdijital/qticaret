import { fromMedusaAmount } from "../money"
import type { ReturnLine } from "./returns"

/**
 * Withdrawing from a gift card bought on the storefront (adr/0025, the
 * owner's decision of 2026-11-03; TASLAK, avukat onayı bekler, docs/12):
 * a gift card line comes back, within the shop's withdrawal period from
 * the day its cards were sent, only while every card it issued is
 * untouched (its whole value left). Once one was spent the line is outside
 * the right of withdrawal (`gift_card_used`), whatever the reason given.
 * Nothing travels back: the cards it withdraws are voided (their balance
 * debited to zero, the plugin's cards having no closed state) and the
 * money follows. It is asked on its own and only as money back. Pure.
 */

/** A withdrawal's debit on a card's account names the request by this reference. */
export const GIFT_WITHDRAWAL_REFERENCE = "return_request"

/** A cancel's debit on a card's account names the order by this reference. */
export const GIFT_CANCEL_REFERENCE = "order_cancel"

/** The debits that void a card rather than spend it: a withdrawal's and the order's cancel. */
export const GIFT_VOID_REFERENCES: readonly string[] = [
  GIFT_WITHDRAWAL_REFERENCE,
  GIFT_CANCEL_REFERENCE,
]

const DAY = 24 * 60 * 60 * 1000

export interface GiftCardFacts {
  id: string
  account_id: string | null
  /** In lira, as the loyalty plugin keeps it. */
  value: number
  balance: number
  /** A debit other than a void's: spent at checkout, or closed by staff. */
  spent: boolean
  /** Voided already, by a withdrawal or the order's cancel. */
  withdrawn: boolean
  created_at: Date
}

/** A void's debit, as the loyalty plugin's `debitAccountsWorkflow` takes it. */
export interface CardDebit {
  account_id: string
  amount: number
  reference: string
  reference_id: string
  note: string
}

export interface GiftLineFacts {
  line_id: string
  /** The cards the line issued; none before its payment came. */
  cards: GiftCardFacts[]
}

const kurusOf = (amount: number) => fromMedusaAmount(amount, { allowRounding: true })

/** A card no one touched: never spent, never withdrawn, its whole value left. */
export const untouchedCard = (card: GiftCardFacts): boolean =>
  !card.spent && !card.withdrawn && kurusOf(card.balance) >= kurusOf(card.value)

/** Any of the line's cards spent: the line is outside the right of withdrawal. */
export const giftLineUsed = (line: GiftLineFacts): boolean =>
  line.cards.some((card) => card.spent || (!card.withdrawn && !untouchedCard(card)))

/** When the line's cards reached their recipient: the last one made; null before any. */
export function giftLineIssuedAt(line: GiftLineFacts): Date | null {
  const times = line.cards.map((card) => card.created_at.getTime())
  return times.length ? new Date(Math.max(...times)) : null
}

/** Whether the line can still be withdrawn from: its cards sent, within the period. */
export function giftWindowOpen(line: GiftLineFacts, now: Date, days: number): boolean {
  const issued = giftLineIssuedAt(line)
  return issued !== null && now.getTime() - issued.getTime() <= days * DAY
}

/**
 * Units of a gift line still to withdraw: its cards, less those earlier
 * requests asked for and those refunded without a request; none once a
 * card was spent.
 */
export function giftReturnable(line: GiftLineFacts, taken: number, kept: number): number {
  return giftLineUsed(line) ? 0 : Math.max(line.cards.length - taken - kept, 0)
}

/**
 * Why the asked lines cannot come back as a gift card withdrawal (an i18n
 * key); null when they can, and for a request of no gift card line. The
 * quantities are `linesProblem`'s to check.
 */
export function giftReturnProblem(
  wanted: readonly ReturnLine[],
  gifts: ReadonlyMap<string, GiftLineFacts>,
  request: { kind: "return" | "exchange" },
  now: Date,
  days: number
): string | null {
  const asked = wanted.flatMap((line) => {
    const gift = gifts.get(line.line_item_id)
    return gift ? [gift] : []
  })
  if (asked.length === 0) {
    return null
  }
  if (asked.length !== wanted.length || request.kind !== "return") {
    return "returns.gift_card_separate"
  }
  if (asked.some(giftLineUsed)) {
    return "returns.gift_card_used"
  }
  return asked.every((line) => giftWindowOpen(line, now, days)) ? null : "returns.window_closed"
}

/**
 * The cards a withdrawal voids: for each line, as many untouched cards as
 * units asked, the first made first. Null when a line asked for no gift
 * card line or one has fewer left (a card spent since the request).
 */
export function cardsToVoid(
  wanted: readonly ReturnLine[],
  gifts: ReadonlyMap<string, GiftLineFacts>
): GiftCardFacts[] | null {
  const cards: GiftCardFacts[] = []
  for (const line of wanted) {
    const gift = gifts.get(line.line_item_id)
    if (!gift || giftLineUsed(gift)) {
      return null
    }
    const left = gift.cards
      .filter(untouchedCard)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
    if (line.quantity < 1 || left.length < line.quantity) {
      return null
    }
    cards.push(...left.slice(0, line.quantity))
  }
  return cards
}

/**
 * The cards an order's cancel voids (adr/0025, 2026-11-03): every card its
 * gift lines issued that is still untouched (none before payment came; a
 * card withdrawn before is void already). Null once one was spent or
 * closed by staff: the cards are the recipient's, the order is not
 * cancelled (`orders.gift_card_used`).
 */
export function cardsVoidedByCancel(lines: Iterable<GiftLineFacts>): GiftCardFacts[] | null {
  const all = [...lines]
  if (all.some(giftLineUsed)) {
    return null
  }
  return all.flatMap((line) => line.cards.filter(untouchedCard))
}

/** The debits voiding `cards`: each one's whole balance, under the void's reference. */
export const voidingDebits = (
  cards: readonly GiftCardFacts[],
  by: { reference: string; reference_id: string; note: string }
): CardDebit[] =>
  cards.map((card) => ({ account_id: card.account_id ?? "", amount: card.balance, ...by }))

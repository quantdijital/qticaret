import { giftCardSpent, splitAdvance } from "../invoicing/advance"
import type { CreditLineRow } from "../invoicing/advance"
import type { InvoiceItem } from "../invoicing/lines"
import { ZERO_KURUS, addKurus, fromMedusaAmount } from "../money"
import type { Kurus } from "../money"

/**
 * Gift cards in the month's package (adr/0025, the owner 2026-11-03): a
 * card is a payment instrument (docs/mali-musavir-sorulari.md 3.2), so
 * selling one is money taken in advance (avans), not a sale, and spending
 * one is how a sale was paid. Each is a row of its own, beside the sales
 * the cards' lines are taken out of. Pure.
 */

export const GIFT_CARD_MOVES = {
  sold: "Satılan hediye kartı (avans)",
  spent: "Kullanılan hediye kartı",
} as const
export type GiftCardMoveKind = keyof typeof GIFT_CARD_MOVES

/** Cards sold on an order (its gift card lines' total) or spent on it (its gift card credit lines). */
export interface GiftCardMove {
  kind: GiftCardMoveKind
  order_display_id: number | null
  day: string
  amount: Kurus
}

type Rows<T> = (T | null)[] | null | undefined

export interface GiftCardOrder {
  display_id: number
  created_at: string | Date
  version?: number | null
  items?: Rows<InvoiceItem>
  credit_lines?: Rows<CreditLineRow>
}

/**
 * An order as the package's sales read it, its gift card lines taken out,
 * and the gift card money it moved: the cards it sold and those it spent,
 * each on the day it was placed.
 */
export function giftCardSplit<T extends GiftCardOrder>(
  order: T,
  giftLines: ReadonlySet<string>,
  dayOf: (at: string | Date) => string
): { order: T; moves: GiftCardMove[] } {
  const { order: sold, advance } = splitAdvance(order, giftLines)
  const day = dayOf(order.created_at)
  const moves: GiftCardMove[] = []
  const advanceKurus = fromMedusaAmount(advance)
  if (advanceKurus > 0) {
    moves.push({ kind: "sold", order_display_id: order.display_id, day, amount: advanceKurus })
  }
  const spent = giftCardSpent(order)
  if (spent > 0) {
    moves.push({ kind: "spent", order_display_id: order.display_id, day, amount: spent })
  }
  return { order: sold, moves }
}

/** The month's total of each kind of move, none left out (0 when there was none). */
export function giftCardTotals(moves: readonly GiftCardMove[]): Record<GiftCardMoveKind, Kurus> {
  const totals: Record<GiftCardMoveKind, Kurus> = { sold: ZERO_KURUS, spent: ZERO_KURUS }
  for (const move of moves) {
    totals[move.kind] = addKurus(totals[move.kind], move.amount)
  }
  return totals
}

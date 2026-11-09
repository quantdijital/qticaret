import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { GiftCardState } from "@/features/gift-cards/search"
import { sdk } from "@/lib/sdk"

/** Gift cards (F4.8, ADR-0025): the loyalty plugin's routes, there while the shop's flag is on. */

export const GIFT_CARDS_FLAG = "promotions.gift_cards"
/** The server's page (`GET /admin/gift-card-list`). */
export const GIFT_CARD_PAGE = 25
const FIELDS = [
  "id",
  "code",
  "status",
  "value",
  "currency_code",
  "expires_at",
  "note",
  "created_at",
  "store_credit_account.id",
  "store_credit_account.balance",
].join(",")

export interface GiftCard {
  id: string
  code: string
  status: string
  value: number
  currency_code: string
  expires_at: string | null
  note: string | null
  created_at: string
  /** What is left on the card; absent before its account is made. */
  store_credit_account?: { id?: string; balance: number } | null
}

export interface GiftCardListParams {
  /** A code or its start. */
  q: string
  state: GiftCardState | "all"
  /** 0-based. */
  page: number
}

/**
 * A page of the shop's cards, newest first, by a code or its start and by
 * where they stand; how many match, and whether a state filter read only
 * the newest cards (`limited`).
 */
export const giftCardsQuery = ({ q, state, page }: GiftCardListParams) =>
  queryOptions({
    queryKey: ["gift-cards", "list", { q, state, page }],
    queryFn: async () => {
      const answer = await sdk.client.fetch<{
        gift_cards: GiftCard[]
        count: number
        limited: boolean
      }>("/admin/gift-card-list", {
        query: {
          ...(q.trim() ? { q: q.trim() } : {}),
          ...(state === "all" ? {} : { state }),
          offset: page * GIFT_CARD_PAGE,
        },
      })
      return { cards: answer.gift_cards, count: answer.count, limited: answer.limited }
    },
    placeholderData: keepPreviousData,
  })

/**
 * A code as the list shows it: its word and last group, the rest hidden
 * (whoever reads a code spends the card): `GIFT-••••-••••-••••-7KQ2`.
 */
export function maskCode(code: string): string {
  const parts = code.split("-")
  if (parts.length < 3) {
    return code.length > 4 ? `${"•".repeat(Math.min(code.length - 4, 12))}${code.slice(-4)}` : code
  }
  const last = parts.length - 1
  return parts
    .map((part, index) => (index === 0 || index === last ? part : "•".repeat(part.length)))
    .join("-")
}

/** What is left on a card; before its account is made, its value. */
export const cardBalance = (card: GiftCard): number =>
  card.store_credit_account?.balance ?? card.value

/** Whether a card can be closed here: it has an account and something left on it. */
export const closable = (card: GiftCard): boolean =>
  Boolean(card.store_credit_account?.id) && cardBalance(card) > 0

/** One card, as the order page links to it (`?card=`). */
export const giftCardQuery = (id: string) =>
  queryOptions({
    queryKey: ["gift-cards", "card", id],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ gift_card: GiftCard }>(
          `/admin/gift-cards/${encodeURIComponent(id)}`,
          { query: { fields: FIELDS } }
        )
      ).gift_card,
  })

/** A card has no last day: cards do not expire (adr/0025, 2026-10-31). */
export interface NewGiftCard {
  value: number
  note: string | null
}

/** A card for the shop to hand out; the plugin makes its code. */
export const CREATE_GIFT_CARD = ["gift-cards", "create"] as const

export function useCreateGiftCard() {
  const client = useQueryClient()
  return useMutation({
    mutationKey: CREATE_GIFT_CARD,
    mutationFn: async (input: NewGiftCard) =>
      (
        await sdk.client.fetch<{ gift_card: GiftCard }>("/admin/gift-cards", {
          method: "POST",
          body: { currency_code: "try", ...input },
        })
      ).gift_card,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["gift-cards"] })
    },
  })
}

export interface CloseGiftCard {
  accountId: string
  /** The ledger's note: why the card was closed. */
  note: string
}

/**
 * Closes a card (adr/0025 Ek 2026-11-03): the plugin's cards have no closed
 * state, so what is left on it is debited to zero
 * (`POST /admin/store-credit-accounts/:id/debit`); the movement stays in
 * the account's ledger with its note. The balance is read again just
 * before, so a card spent meanwhile is not debited past it. Resolves with
 * the amount taken off (0 when nothing was left).
 */
export const CLOSE_GIFT_CARD = ["gift-cards", "close"] as const

export function useCloseGiftCard() {
  const client = useQueryClient()
  return useMutation({
    mutationKey: CLOSE_GIFT_CARD,
    mutationFn: async ({ accountId, note }: CloseGiftCard) => {
      const account = `/admin/store-credit-accounts/${encodeURIComponent(accountId)}`
      const { store_credit_account: current } = await sdk.client.fetch<{
        store_credit_account: { id: string; balance: number }
      }>(account, { query: { fields: "id,balance" } })
      const amount = current.balance
      if (!(amount > 0)) {
        return 0
      }
      await sdk.client.fetch(`${account}/debit`, { method: "POST", body: { amount, note } })
      return amount
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["gift-cards"] })
    },
  })
}

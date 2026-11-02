import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Gift cards (F4.8, ADR-0025): the loyalty plugin's routes, there while the shop's flag is on. */

export const GIFT_CARDS_FLAG = "promotions.gift_cards"
// A shop's cards fit one read for now; selling them (F9) brings paging
const READ = 200
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

/** The newest cards, and how many the shop has in all. */
export const giftCardsQuery = () =>
  queryOptions({
    queryKey: ["gift-cards", "list"],
    queryFn: async () => {
      const { gift_cards: cards, count } = await sdk.client.fetch<{
        gift_cards: GiftCard[]
        count?: number
      }>("/admin/gift-cards", { query: { fields: FIELDS, limit: READ, order: "-created_at" } })
      return { cards, count: count ?? cards.length }
    },
  })

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

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
  store_credit_account?: { balance: number } | null
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

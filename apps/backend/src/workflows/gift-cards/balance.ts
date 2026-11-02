import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { shopperGiftCard } from "../../api/http/shopper-gift-cards"
import { normalizeCode } from "../../lib/promotions"
import { safeEqual } from "../../lib/security"

export interface GiftCardBalance {
  balance: number
  currency_code: string
  expires_at: string | null
}

interface ShownCard {
  code?: string
  currency_code?: string
  expires_at?: string | Date | null
  store_credit_account?: { balance?: number | string | null; currency_code?: string } | null
}

/**
 * What a card has left, by its code (adr/0025 Ek 2026-11-03): read as the
 * plugin's own lookup reads it, cut to what a shopper sees of a card
 * (`shopperGiftCard`), and the code compared again in constant time: a
 * database's case folding or a near match is never a card. Null: no card.
 */
export async function giftCardBalance(
  container: Pick<MedusaContainer, "resolve">,
  code: string
): Promise<GiftCardBalance | null> {
  const wanted = normalizeCode(code)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "gift_card",
    fields: [
      "id",
      "code",
      "currency_code",
      "expires_at",
      "store_credit_account.balance",
      "store_credit_account.currency_code",
    ],
    filters: { code: wanted },
  })
  const card = shopperGiftCard(data[0]) as ShownCard | undefined
  // Compared whether found or not, so both answers take as long
  const same = safeEqual(card?.code ?? "", wanted || "-")
  if (!card || !same) {
    return null
  }
  const expires = card.expires_at ? new Date(card.expires_at) : null
  return {
    balance: Number(card.store_credit_account?.balance ?? 0),
    currency_code: card.store_credit_account?.currency_code ?? card.currency_code ?? "try",
    expires_at: expires ? expires.toISOString() : null,
  }
}

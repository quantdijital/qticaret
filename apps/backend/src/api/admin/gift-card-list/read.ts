import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cardState, codeFilter } from "../../../lib/promotions/gift-card-list"
import type { ListedCard } from "../../../lib/promotions/gift-card-list"
import { GIFT_CARD_LIST_PAGE } from "./validators"
import type { AdminGetGiftCardListType } from "./validators"

// Cards read at most to filter by state (the balance is another module's); past it `limited`
const MAX_SCANNED = 5000

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
]

/**
 * The shop's cards newest first, a page at a time (adr/0025): by a code or
 * its start, and by where each stands (spendable, spent, expired). Without
 * a state the plugin's query pages them; a state reads the newest
 * MAX_SCANNED matching cards and keeps those in it.
 */
export async function readGiftCardList(scope: MedusaContainer, params: AdminGetGiftCardListType) {
  const { q, state, offset } = params
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const code = codeFilter(q)
  const filters = (code ? { code } : {}) as Record<string, never>
  const page = { offset, limit: GIFT_CARD_LIST_PAGE }
  if (!state) {
    const { data, metadata } = await query.graph({
      entity: "gift_card",
      fields: FIELDS,
      filters,
      pagination: { skip: offset, take: GIFT_CARD_LIST_PAGE, order: { created_at: "DESC" } },
    })
    return { gift_cards: data, count: metadata?.count ?? data.length, limited: false, ...page }
  }
  const { data, metadata } = await query.graph({
    entity: "gift_card",
    fields: FIELDS,
    filters,
    pagination: { skip: 0, take: MAX_SCANNED, order: { created_at: "DESC" } },
  })
  const now = new Date()
  const matching = (data as ListedCard[]).filter((card) => cardState(card, now) === state)
  return {
    gift_cards: matching.slice(offset, offset + GIFT_CARD_LIST_PAGE),
    count: matching.length,
    limited: (metadata?.count ?? data.length) > data.length,
    ...page,
  }
}

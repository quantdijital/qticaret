import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { GIFT_VOID_REFERENCES } from "../../lib/orders/gift-returns"
import type { GiftCardFacts, GiftLineFacts } from "../../lib/orders/gift-returns"
import { giftLineIdsOf } from "../gift-cards/gift-marks"

type Container = Pick<MedusaContainer, "resolve">

type ItemRow = { id: string; product_id?: string | null; metadata?: unknown } | null

interface CardRow {
  id: string
  value?: number | string | null
  line_item_id?: string | null
  created_at?: string | Date | null
  store_credit_account?: {
    id?: string | null
    balance?: number | string | null
    transactions?: ({ type?: string | null; reference?: string | null } | null)[] | null
  } | null
}

/**
 * An order's gift card lines (`giftLineIdsOf`) with the cards each issued:
 * their value, what is left on them, and whether a debit other than a
 * void's (a withdrawal's, the order's cancel) touched them (spent at
 * checkout, closed by staff). Every gift line is in it, with no cards
 * before its payment came. Codes are never read.
 */
export async function giftLinesOf(
  container: Container,
  items: readonly ItemRow[]
): Promise<Map<string, GiftLineFacts>> {
  const ids = await giftLineIdsOf(container, items)
  const lines = new Map<string, GiftLineFacts>(
    [...ids].map((id) => [id, { line_id: id, cards: [] }])
  )
  if (ids.size === 0) {
    return lines
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "gift_card",
    fields: [
      "id",
      "value",
      "line_item_id",
      "created_at",
      "store_credit_account.id",
      "store_credit_account.balance",
      "store_credit_account.transactions.type",
      "store_credit_account.transactions.reference",
    ],
    filters: { line_item_id: [...ids] },
  })
  for (const card of data as CardRow[]) {
    const line = card.line_item_id ? lines.get(card.line_item_id) : undefined
    if (!line) {
      continue
    }
    const debits = (card.store_credit_account?.transactions ?? []).filter(
      (move) => move?.type === "debit"
    )
    const facts: GiftCardFacts = {
      id: card.id,
      account_id: card.store_credit_account?.id ?? null,
      value: Number(card.value ?? 0),
      balance: Number(card.store_credit_account?.balance ?? 0),
      spent: debits.some((move) => !GIFT_VOID_REFERENCES.includes(move?.reference ?? "")),
      withdrawn: debits.some((move) => GIFT_VOID_REFERENCES.includes(move?.reference ?? "")),
      created_at: new Date(card.created_at ?? 0),
    }
    line.cards.push(facts)
  }
  return lines
}

/** Whether a request asks for gift card lines alone: withdrawn by voiding their cards, nothing sent back. */
export async function isGiftReturn(
  container: Container,
  request: { order_id: string; items: unknown }
): Promise<boolean> {
  const asked = Array.isArray(request.items)
    ? (request.items as { line_item_id: string }[]).map((line) => line.line_item_id)
    : []
  if (asked.length === 0) {
    return false
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["items.id", "items.product_id", "items.metadata"],
    filters: { id: request.order_id },
  })
  const items = (data[0] as { items?: ItemRow[] | null } | undefined)?.items ?? []
  const gifts = await giftLineIdsOf(container, items)
  return asked.every((id) => gifts.has(id))
}

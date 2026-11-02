import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { kurus, subtractKurus } from "../../lib/money"
import { paidInTestMode } from "../../lib/payments/test-mode"
import type { GiftOrderFacts } from "../../lib/promotions/gift-sale"
import { readOrderMoney } from "../orders/order-money"
import { giftProductsAmong } from "./gift-products"

type Container = Pick<MedusaContainer, "resolve">

/** A card as issuing reads it back: its code stays on the server. */
export interface LineCard {
  id: string
  code: string
  line_item_id: string
  key: string | null
}

/** The metadata key a sold card carries its idempotency key under. */
export const ISSUE_KEY = "qt_issue_key"

interface OrderRow {
  id: string
  status?: string | null
  items?:
    | ({
        id: string
        product_id?: string | null
        metadata?: Record<string, unknown> | null
      } | null)[]
    | null
  payment_collections?: ({ payments?: ({ data?: unknown } | null)[] | null } | null)[] | null
}

/** The cards already made for these order lines, whatever made them. */
export async function cardsOfLines(
  container: Container,
  lineIds: readonly string[]
): Promise<LineCard[]> {
  if (lineIds.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "gift_card",
    fields: ["id", "code", "line_item_id", "metadata", "created_at"],
    filters: { line_item_id: [...lineIds] },
  })
  return (
    data as {
      id: string
      code: string
      line_item_id?: string | null
      metadata?: Record<string, unknown> | null
      created_at?: string | Date
    }[]
  )
    .filter((card) => typeof card.line_item_id === "string")
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
    .map((card) => ({
      id: card.id,
      code: card.code,
      line_item_id: card.line_item_id ?? "",
      key: typeof card.metadata?.[ISSUE_KEY] === "string" ? card.metadata[ISSUE_KEY] : null,
    }))
}

export interface OrderGifts {
  facts: GiftOrderFacts
  currency_code: string
  /** Each gift line's metadata as stored, for the record of its cards. */
  metadata: Map<string, Record<string, unknown> | null>
  cards: LineCard[]
}

/**
 * What issuing needs of an order: its gift lines (a unit's value is its
 * price, KDV included, before discounts), the cards they already have,
 * whether it is canceled or paid in test mode, and its money in kuruş
 * (F4.7's reading: what the payments must cover, took and gave back).
 * Null for an order without gift lines.
 */
export async function orderGifts(
  container: Container,
  orderId: string
): Promise<OrderGifts | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "status",
      "items.id",
      "items.product_id",
      "items.metadata",
      "payment_collections.payments.data",
    ],
    filters: { id: orderId },
  })
  const row = data[0] as OrderRow | undefined
  const items = (row?.items ?? []).flatMap((item) => (item ? [item] : []))
  const giftProducts = await giftProductsAmong(
    container,
    items.map((item) => item.product_id)
  )
  const gifts = items.filter((item) => item.product_id && giftProducts.has(item.product_id))
  if (!row || gifts.length === 0) {
    return null
  }
  const money = await readOrderMoney(container as MedusaContainer, orderId)
  const cards = await cardsOfLines(
    container,
    gifts.map((item) => item.id)
  )
  const giftIds = new Set(gifts.map((item) => item.id))
  const lines = money.lines
    .filter((line) => line.kind === "item")
    .map((line) => ({
      id: line.id,
      quantity: line.quantity,
      unit_kurus: line.quantity > 0 ? Math.round(line.gross / line.quantity) : 0,
      gift: giftIds.has(line.id),
      issued: cards.filter((card) => card.line_item_id === line.id).length,
    }))
  return {
    facts: {
      order_id: orderId,
      canceled: row.status === "canceled",
      test_mode: paidInTestMode(row),
      due: subtractKurus(money.net, money.credit),
      paid: money.paid,
      refunded: money.refunded,
      lines,
    },
    currency_code: money.currency_code,
    metadata: new Map(gifts.map((item) => [item.id, item.metadata ?? null])),
    cards,
  }
}

/** Kuruş as the loyalty plugin keeps a card's value: in lira. */
export const liraOfKurus = (value: number): number => kurus(value) / 100

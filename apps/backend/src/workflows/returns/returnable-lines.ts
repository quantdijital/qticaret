import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { RETURN_ORDER_FIELDS, counted, returnable, windowState } from "../../lib/orders/returns"
import type { ReturnOrderFacts, WindowState } from "../../lib/orders/returns"
import { giftReturnable, giftWindowOpen, giftWindowState } from "../../lib/orders/gift-returns"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { COUNTED_RETURN_STATUSES, OPEN_RETURN_STATUSES } from "../../modules/return-requests/states"
import { giftLinesOf } from "./gift-lines"
import { returnPolicy, withdrawalFactsOf } from "./policy"

const closedReason = (state: WindowState): Exclude<WindowState, "open"> | null =>
  state === "open" ? null : state

interface LineFacts {
  id: string
  title?: string | null
  variant_title?: string | null
  variant_id?: string | null
  product_id?: string | null
}

/**
 * What staff may ask back for a shopper (F12.3): each line's units left
 * to return, by the same rules a shopper's request meets (`requestReturn`),
 * the product's variants to exchange it for, whether its window is open
 * (each line by its own kind and dates, and why not) and whether a
 * request is already open, and why a line is outside the
 * right of withdrawal or what it warns of (a sealed good, adr/0032 Ek
 * 2026-11-03). A gift card line's units are its cards, while none
 * was spent and within the period from the day they were sent (adr/0025,
 * 2026-11-03). Titles only, nothing personal.
 */
export async function returnableLines(
  container: MedusaContainer,
  orderId: string,
  now = new Date()
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "status",
      ...RETURN_ORDER_FIELDS,
      "items.title",
      "items.variant_title",
      "items.variant_id",
      "items.product_id",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as (ReturnOrderFacts & { status?: string }) | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  const earlier = await container
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests(
      { order_id: orderId, status: [...COUNTED_RETURN_STATUSES] },
      { select: ["status", "items", "received_items", "damaged_items", "refused_items"] }
    )
  const kept = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .keptUnits(orderId)
  const asked = earlier.flatMap(counted)
  const left = returnable(order, asked, kept)
  const gifts = await giftLinesOf(container, order.items ?? [])
  const [policy, { excluded, warnings }] = await Promise.all([
    returnPolicy(container),
    withdrawalFactsOf(container, order.items ?? [], gifts),
  ])
  const giftOpen = [...gifts.values()].filter((gift) =>
    giftWindowOpen(gift, now, policy.withdrawal_days)
  )
  for (const gift of giftOpen) {
    const taken = asked
      .filter((line) => line.line_item_id === gift.line_id)
      .reduce((sum, line) => sum + line.quantity, 0)
    left.set(gift.line_id, giftReturnable(gift, taken, kept.get(gift.line_id) ?? 0))
  }
  const items = ((order as { items?: (LineFacts | null)[] | null }).items ?? []).filter(
    (item): item is LineFacts => item !== null
  )
  const productIds = [
    ...new Set(items.flatMap((item) => (item.product_id ? [item.product_id] : []))),
  ]
  const { data: products } = productIds.length
    ? await query.graph({
        entity: "product",
        fields: ["id", "variants.id", "variants.title"],
        filters: { id: productIds },
      })
    : { data: [] }
  const variantsOf = new Map(
    (
      products as {
        id: string
        variants?: ({ id: string; title?: string | null } | null)[] | null
      }[]
    ).map((product) => [
      product.id,
      (product.variants ?? []).flatMap((variant) =>
        variant ? [{ id: variant.id, title: variant.title ?? null }] : []
      ),
    ])
  )
  // Each line by its own kind: the parcels' window for goods, its cards' for a gift line
  const parcels = windowState(order, now, policy.withdrawal_days)
  const windowOf = (id: string): WindowState => {
    if (order.status === "canceled") {
      return "order_canceled"
    }
    const gift = gifts.get(id)
    return gift ? giftWindowState(gift, now, policy.withdrawal_days) : parcels
  }
  return {
    /** Any line's window open (the request's own check is per line, `requestReturn`). */
    window_open: order.status !== "canceled" && (parcels === "open" || giftOpen.length > 0),
    open_request: earlier.some((request) =>
      (OPEN_RETURN_STATUSES as readonly string[]).includes(request.status)
    ),
    lines: items.map((item) => ({
      line_item_id: item.id,
      title: item.title ?? null,
      variant_title: item.variant_title ?? null,
      variant_id: item.variant_id ?? null,
      returnable: left.get(item.id) ?? 0,
      /** This line's window, by its kind and dates: what `requestReturn` checks it by. */
      window_open: windowOf(item.id) === "open",
      /** Why it is shut: `not_yet`, `expired`, `order_canceled`; null while open. */
      window_closed_reason: closedReason(windowOf(item.id)),
      // Outside the right of withdrawal: back only as faulty or wrong (F13.6)
      withdrawal_excluded: excluded.has(item.id),
      /** `product`, `personal_addon` or `gift_card_used`; null inside the right. */
      withdrawal_excluded_reason: excluded.get(item.id) ?? null,
      /** Inside the right with a condition: `sealed_goods`, back only unopened (md. 15/1-ç). */
      withdrawal_warning: warnings.get(item.id) ?? null,
      /** A gift card line: withdrawn on its own, its cards voided, nothing sent back. */
      gift_card: gifts.has(item.id),
      // An exchange goes for another variant of the same product (adr/0032 §6)
      variants: (item.product_id ? (variantsOf.get(item.product_id) ?? []) : []).filter(
        (variant) => variant.id !== item.variant_id
      ),
    })),
  }
}

export type ReturnableLines = Awaited<ReturnType<typeof returnableLines>>

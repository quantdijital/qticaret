import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { fromMedusaAmount } from "../../lib/money"
import type { MedusaAmount } from "../../lib/money"
import { WHOLESALE_ORDER_TRIGGER } from "../../lib/notifications/feed"
import { notificationText } from "../../lib/notifications/messages"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import { linkIdOfCart } from "../payment-links/cart-guard"

type Container = Pick<MedusaContainer, "resolve">

/** The one alert a placed order rings in the bell, or none. */
export type PlacedAlert = "wholesale_order" | "bank_transfer_pending" | "new_order"

export const NEW_ORDER_TRIGGER = "orders.new_order"

/** The one key an order's placed alert is written under, whichever kind it is. */
export const placedAlertKey = (orderId: string) => `order_placed:${orderId}`
export const BANK_TRANSFER_TRIGGER = "orders.bank_transfer_pending"

/**
 * Which alert an order rings (the owner, 2026-11-16: "her yeni sipariş
 * zile düşsün"), one per order:
 * - paid through a payment link: none, the link's own "paid" alert says
 *   it (adr/0051), unless by bank transfer, whose money is still awaited;
 * - a wholesaler's: the wholesale one only (it says when a transfer is
 *   awaited), shown to the roles that see wholesalers;
 * - by bank transfer: "transfer awaited", as before;
 * - any other: "new order".
 */
export function placedAlertOf(facts: {
  wholesale: boolean
  bankTransfer: boolean
  paymentLink: boolean
}): PlacedAlert | null {
  if (facts.paymentLink) {
    return facts.bankTransfer ? "bank_transfer_pending" : null
  }
  if (facts.wholesale) {
    return "wholesale_order"
  }
  return facts.bankTransfer ? "bank_transfer_pending" : "new_order"
}

interface OrderRow {
  id: string
  display_id: number
  total: MedusaAmount
  currency_code?: string | null
  cart?: { metadata?: Record<string, unknown> | null } | null
  payment_collections?:
    ({ payment_sessions?: ({ provider_id: string } | null)[] | null } | null)[] | null
}

const TRIGGERS: Record<PlacedAlert, string> = {
  wholesale_order: WHOLESALE_ORDER_TRIGGER,
  bank_transfer_pending: BANK_TRANSFER_TRIGGER,
  new_order: NEW_ORDER_TRIGGER,
}

/**
 * Rings the order's one alert (`placedAlertOf`) once: the row's key is the
 * order's, so a repeated `order.placed` (a retry after a failed write)
 * writes nothing twice. The row keeps ids, the number, the total and
 * whether a transfer is awaited, no one's name: a wholesaler is named when
 * the page lists it (`workflows/notifications/list.ts`).
 */
export async function alertPlacedOrder(
  container: Container,
  orderId: string,
  wholesaleAccountId: string | null
): Promise<PlacedAlert | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "total",
      "currency_code",
      "cart.metadata",
      "payment_collections.payment_sessions.provider_id",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as OrderRow | undefined
  if (!order) {
    return null
  }
  const bankTransfer = (order.payment_collections ?? []).some((collection) =>
    (collection?.payment_sessions ?? []).some(
      (session) => session?.provider_id === BANK_TRANSFER_PAYMENT_PROVIDER_ID
    )
  )
  const kind = placedAlertOf({
    wholesale: wholesaleAccountId !== null,
    bankTransfer,
    paymentLink: linkIdOfCart(order.cart?.metadata) !== null,
  })
  if (!kind) {
    return null
  }
  // One alert per order whatever its kind: a run whose stamp failed rang the retail one, and
  // the event coming again (the stamp written now) rings no wholesale one beside it
  const notifications = container.resolve(Modules.NOTIFICATION)
  const [rung] = await notifications.listNotifications(
    { channel: "feed", resource_id: order.id, trigger_type: Object.values(TRIGGERS) },
    { select: ["id"], take: 1 }
  )
  if (rung) {
    return null
  }
  const number = String(order.display_id)
  const total = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: (order.currency_code ?? "try").toUpperCase(),
  }).format(fromMedusaAmount(order.total, { allowRounding: true }) / 100)
  const trigger = TRIGGERS[kind]
  await notifications.createNotifications({
    to: "",
    channel: "feed",
    template: "admin-ui",
    trigger_type: trigger,
    resource_id: order.id,
    resource_type: "order",
    // One key per order whatever the kind: two runs at once (a repeated event) cannot both
    // write, a retail and a wholesale row side by side included; the notification module
    // keeps `idempotency_key` unique
    idempotency_key: placedAlertKey(order.id),
    data: {
      kind,
      order_id: order.id,
      number,
      total,
      ...(kind === "wholesale_order" && wholesaleAccountId
        ? { account_id: wholesaleAccountId, bank_transfer: bankTransfer }
        : {}),
      ...notificationText(trigger, { number, total }),
    },
  })
  return kind
}

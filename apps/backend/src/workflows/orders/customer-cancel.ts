import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import { CANCEL_BY_CONTACT, bookingFlow } from "../../lib/booking/flow"
import { ValidationError } from "../../lib/errors"
import { cardsVoidedByCancel } from "../../lib/orders/gift-returns"
import { cancelLockKeys } from "../../lib/orders/locks"
import { isOfflineProvider } from "../../lib/payments/checkout"
import { giftLinesOf } from "../returns/gift-lines"
import { cancelGiftCardsWorkflow } from "./cancel-gift-cards"
import { readOrderMoney } from "./order-money"

export interface CancelOrderRow {
  customer_id?: string | null
  status?: string
  fulfillments?: ({ canceled_at?: unknown } | null)[] | null
  items?: ({ metadata?: unknown } | null)[] | null
  payment_collections?:
    | ({
        payments?: ({ provider_id?: string | null; captured_at?: unknown } | null)[] | null
      } | null)[]
    | null
}

/** The order fields the shopper's cancel is decided on (`cancelRefusal`). */
export const CANCEL_ORDER_FIELDS = [
  "customer_id",
  "status",
  "fulfillments.canceled_at",
  "items.metadata",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
]

/**
 * Why the shopper may not cancel the order (an i18n key); null when they
 * may. Cancelled already (`orders.canceled`: the cancel answers as done);
 * a parcel packed or the order completed (`orders.cancel_after_packing`:
 * it comes back as a return); money taken by hand, a bank transfer the
 * shop confirmed or a difference staff collected on an edit
 * (`orders.cancel_contact_shop`: the refund would only be written down,
 * security review 2026-10-28); a paid order with a dated line
 * (`booking.use_booking_cancel`: its departures are cancelled one by
 * one, by their tiers, adr/0076 Ek D7a); any order with a dated line
 * while the shop takes cancels by phone or e-mail (`onlineCancel` false:
 * `booking.cancel_by_contact`, paid or not, adr/0076 Ek basit yol).
 * Pure: the cancel and the order page's `cancellable` read the same rule.
 */
export function cancelRefusal(order: CancelOrderRow, onlineCancel = true): string | null {
  if (order.status === "canceled") {
    return "orders.canceled"
  }
  const packed = (order.fulfillments ?? []).some(
    (fulfillment) => fulfillment && !fulfillment.canceled_at
  )
  if (order.status === "completed" || packed) {
    return "orders.cancel_after_packing"
  }
  const dated = (order.items ?? []).some((item) => bookingMarkOf(item?.metadata) !== null)
  if (dated && !onlineCancel) {
    return CANCEL_BY_CONTACT
  }
  const taken = (order.payment_collections ?? []).flatMap((collection) =>
    (collection?.payments ?? []).filter((payment) => Boolean(payment?.captured_at))
  )
  // Offline money, or a difference staff collected by hand (an edit): it goes back by hand
  const takenByHand =
    taken.length > 1 || taken.some((payment) => isOfflineProvider(payment?.provider_id ?? ""))
  if (takenByHand) {
    return "orders.cancel_contact_shop"
  }
  // A paid dated order is cancelled departure by departure, by its tiers (adr/0076 Ek D7a)
  return dated && taken.length > 0 ? "booking.use_booking_cancel" : null
}

/**
 * Whether the order page offers the cancel, by the rule the cancel meets:
 * `cancelRefusal`, an order with no customer record of its own (the
 * cancel answers it as no order, `orders.unknown`: the shop cancels it), and a gift card it
 * sent already used (`orders.gift_card_used`, as `cancelGiftCardsWorkflow`
 * refuses it). The reason, when the shopper can act on it.
 */
export async function customerCancelState(
  container: MedusaContainer,
  orderId: string
): Promise<{ cancellable: boolean; refusal: string | null }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [...CANCEL_ORDER_FIELDS, "items.id", "items.product_id", "items.metadata"],
    filters: { id: orderId },
  })
  const order = data[0] as
    (CancelOrderRow & { items?: ({ id: string } | null)[] | null }) | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  // No customer record of its own: the cancel answers it as no order
  // The setting is read with each ask (adr/0076 Ek basit yol)
  const { online_cancel_enabled } = await bookingFlow(container)
  const refusal =
    cancelRefusal(order, online_cancel_enabled) ?? (order.customer_id ? null : "orders.unknown")
  if (refusal) {
    return { cancellable: false, refusal }
  }
  const cards = cardsVoidedByCancel((await giftLinesOf(container, order.items ?? [])).values())
  return !cards || cards.some((card) => !card.account_id)
    ? { cancellable: false, refusal: "orders.gift_card_used" }
    : { cancellable: true, refusal: null }
}

/**
 * A shopper cancels their own order before it is packed (F7.13): what was
 * taken is given back through our refund (a reference of its own, so a
 * retry refunds once), then Medusa's cancel releases the stock and the
 * held payment. Under the order's cancel locks (`cancelLockKeys`): no
 * parcel is packed and no bank transfer confirmed meanwhile. A parcel
 * packed or shipped can only come back as a return; money taken outside
 * a card goes back by hand (`cancelRefusal`).
 *
 * Gift cards the order bought and sent are voided before the money goes
 * back, and only while none was used (`cancelGiftCardsWorkflow`, adr/0025
 * 2026-11-03); one spent refuses the cancel (`orders.gift_card_used`).
 */
export async function cancelOrderForCustomer(
  container: MedusaContainer,
  input: { order_id: string; customer_id: string }
): Promise<{ order_id: string; refunded: number }> {
  return container.resolve(Modules.LOCKING).execute(
    cancelLockKeys(input.order_id),
    async () => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: CANCEL_ORDER_FIELDS,
        filters: { id: input.order_id },
      })
      const order = data[0] as CancelOrderRow | undefined
      // Another shopper's order is as good as none
      if (order?.customer_id !== input.customer_id) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
      }
      const { online_cancel_enabled } = await bookingFlow(container)
      const refusal = cancelRefusal(order, online_cancel_enabled)
      if (refusal === "orders.canceled") {
        return { order_id: input.order_id, refunded: 0 }
      }
      if (refusal) {
        throw new ValidationError(refusal)
      }
      const { refundable } = await readOrderMoney(container, input.order_id)
      // One refund per payment, under the payment's own reference (security review Y1)
      await cancelGiftCardsWorkflow(container).run({
        input: {
          order_id: input.order_id,
          refund: { note: "canceled by the customer", created_by: null },
        },
      })
      await cancelOrderWorkflow(container).run({
        input: { order_id: input.order_id, canceled_by: input.customer_id },
      })
      return { order_id: input.order_id, refunded: refundable }
    },
    { timeout: 10 }
  )
}

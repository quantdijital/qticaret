import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { cancelLockKeys, cancelRefundReference } from "../../lib/orders/locks"
import { isOfflineProvider } from "../../lib/payments/checkout"
import { cancelGiftCardsWorkflow } from "./cancel-gift-cards"
import { readOrderMoney } from "./order-money"

interface OrderRow {
  customer_id?: string | null
  status?: string
  fulfillments?: ({ canceled_at?: unknown } | null)[] | null
  payment_collections?:
    | ({
        payments?: ({ provider_id?: string | null; captured_at?: unknown } | null)[] | null
      } | null)[]
    | null
}

/**
 * A shopper cancels their own order before it is packed (F7.13): what was
 * taken is given back through our refund (a reference of its own, so a
 * retry refunds once), then Medusa's cancel releases the stock and the
 * held payment. Under the order's cancel locks (`cancelLockKeys`): no
 * parcel is packed and no bank transfer confirmed meanwhile. A parcel
 * packed or shipped can only come back as a return.
 *
 * Money taken outside a card (a bank transfer the shop confirmed) goes
 * back by hand: the refund would only be written down, so the shopper
 * asks the shop (security review 2026-10-28).
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
        fields: [
          "customer_id",
          "status",
          "fulfillments.canceled_at",
          "payment_collections.payments.provider_id",
          "payment_collections.payments.captured_at",
        ],
        filters: { id: input.order_id },
      })
      const order = data[0] as OrderRow | undefined
      // Another shopper's order is as good as none
      if (order?.customer_id !== input.customer_id) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
      }
      if (order.status === "canceled") {
        return { order_id: input.order_id, refunded: 0 }
      }
      const packed = (order.fulfillments ?? []).some(
        (fulfillment) => fulfillment && !fulfillment.canceled_at
      )
      if (order.status === "completed" || packed) {
        throw new ValidationError("orders.cancel_after_packing")
      }
      const taken = (order.payment_collections ?? []).flatMap((collection) =>
        (collection?.payments ?? []).filter((payment) => Boolean(payment?.captured_at))
      )
      // Offline money, or a difference staff collected by hand (an edit): it goes back by hand
      const takenByHand =
        taken.length > 1 || taken.some((payment) => isOfflineProvider(payment?.provider_id ?? ""))
      if (takenByHand) {
        throw new ValidationError("orders.cancel_contact_shop")
      }
      const { refundable } = await readOrderMoney(container, input.order_id)
      await cancelGiftCardsWorkflow(container).run({
        input: {
          order_id: input.order_id,
          refunds:
            refundable > 0
              ? [
                  {
                    order_id: input.order_id,
                    reference: cancelRefundReference(input.order_id),
                    request: { amount: refundable },
                    note: "canceled by the customer",
                    created_by: null,
                  },
                ]
              : [],
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

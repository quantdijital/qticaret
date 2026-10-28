import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { bankTransferLockKey } from "../../lib/payments/bank-transfer"
import { readOrderMoney } from "./order-money"
import { refundOrderWorkflow } from "./refund-order"

interface OrderRow {
  customer_id?: string | null
  status?: string
  fulfillments?: ({ canceled_at?: unknown } | null)[] | null
}

/**
 * A shopper cancels their own order before it is packed (F7.13): what was
 * taken is given back through our refund (a reference of its own, so a
 * retry refunds once), then Medusa's cancel releases the stock and the
 * held payment. Under the order's lock the shop's bank transfer
 * confirmation and the expiry take too. A parcel packed or shipped can
 * only come back as a return.
 */
export async function cancelOrderForCustomer(
  container: MedusaContainer,
  input: { order_id: string; customer_id: string }
): Promise<{ order_id: string; refunded: number }> {
  return container.resolve(Modules.LOCKING).execute(
    bankTransferLockKey(input.order_id),
    async () => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["customer_id", "status", "fulfillments.canceled_at"],
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
      const { refundable } = await readOrderMoney(container, input.order_id)
      if (refundable > 0) {
        await refundOrderWorkflow(container).run({
          input: {
            order_id: input.order_id,
            reference: `cancel${input.order_id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40),
            request: { amount: refundable },
            note: "canceled by the customer",
            created_by: null,
          },
        })
      }
      await cancelOrderWorkflow(container).run({
        input: { order_id: input.order_id, canceled_by: input.customer_id },
      })
      return { order_id: input.order_id, refunded: refundable }
    },
    { timeout: 10 }
  )
}

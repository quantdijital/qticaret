import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { linesProblem, returnable, windowOpen } from "../../lib/orders/returns"
import type { ReturnLine, ReturnOrderFacts } from "../../lib/orders/returns"
import { RETURN_REQUESTS_MODULE } from "../../modules/return-requests"
import type ReturnRequestsModuleService from "../../modules/return-requests/service"
import { COUNTED_RETURN_STATUSES, OPEN_RETURN_STATUSES } from "../../modules/return-requests/states"
import type { ReturnReason } from "../../modules/return-requests/states"

export const returnsLockKey = (orderId: string): string => `returns:${orderId}`

/**
 * A shopper asks to send lines of their own order back (F7.9, adr/0032):
 * shipped lines, within the window, no more than is left after earlier
 * requests, one request at a time. Under the order's returns lock.
 */
export async function requestReturn(
  container: MedusaContainer,
  input: {
    order_id: string
    customer_id: string
    items: ReturnLine[]
    reason: ReturnReason
    note: string | null
  },
  now = new Date()
) {
  return container.resolve(Modules.LOCKING).execute(
    returnsLockKey(input.order_id),
    async () => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: [
          "customer_id",
          "status",
          "items.id",
          "items.detail.shipped_quantity",
          "fulfillments.shipped_at",
          "fulfillments.delivered_at",
          "fulfillments.canceled_at",
        ],
        filters: { id: input.order_id },
      })
      const order = data[0] as
        (ReturnOrderFacts & { customer_id?: string | null; status?: string }) | undefined
      if (order?.customer_id !== input.customer_id) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
      }
      if (order.status === "canceled" || !windowOpen(order, now)) {
        throw new ValidationError("returns.window_closed")
      }
      const service = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
      const earlier = await service.listReturnRequests(
        { order_id: input.order_id, status: [...COUNTED_RETURN_STATUSES] },
        { select: ["status", "items", "received_items"] }
      )
      if (
        earlier.some((request) =>
          (OPEN_RETURN_STATUSES as readonly string[]).includes(request.status)
        )
      ) {
        throw new ValidationError("returns.already_open")
      }
      // A request that came back counts what came back; one still open, what it asked
      const asked = earlier.flatMap(
        (request) => (request.received_items ?? request.items) as unknown as ReturnLine[]
      )
      const problem = linesProblem(returnable(order, asked), input.items)
      if (problem) {
        throw new ValidationError(problem, { field: "items" })
      }
      return service.createReturnRequests({
        order_id: input.order_id,
        customer_id: input.customer_id,
        reason: input.reason,
        note: input.note,
        items: input.items as unknown as Record<string, unknown>,
      })
    },
    { timeout: 10 }
  )
}

import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  cancelOrderExchangeWorkflow,
  cancelReturnWorkflow,
  emitEventStep,
} from "@medusajs/medusa/core-flows"
import { returnsLockKey } from "../../lib/orders/locks"
import { RETURN_REQUEST_CANCELED } from "./events"
import { readCancellableRequestStep } from "./steps/cancel"
import { returnRequestOrderStep, updateReturnRequestStep } from "./steps/return-request"
import { acquireLocksStep } from "../locking/acquire-locks"
import { releaseLocksStep } from "../locking/release-locks"

export interface CancelReturnInput {
  id: string
  staff_id: string
  /** Staff's own words on why, kept for the team; never shown to the shopper. */
  reason: string
}

/**
 * Staff take back an approval before anything came back (order #691: the
 * shopper gave up, or the approval was a mistake). Under the order's
 * returns lock: the request read and checked (`cancellableRequest`), the
 * request marked cancelled with the staff
 * member and their reason (the approval's note kept), then Medusa's
 * return (or exchange, its new items released) cancelled, so the lines
 * can be asked back again. A step that fails undoes the ones before it;
 * the shopper hears of it (`return_request.canceled`).
 */
export const cancelReturnRequestWorkflow = createWorkflow(
  "returns-cancel-request",
  (input: CancelReturnInput) => {
    const orderId = returnRequestOrderStep({ id: input.id })
    const lockKey = transform({ orderId }, ({ orderId }) => returnsLockKey(orderId))
    const held = acquireLocksStep({ key: lockKey, timeout: 10, ttl: 120 })
    const request = readCancellableRequestStep({ id: input.id })
    const canceled = updateReturnRequestStep(
      transform({ input }, ({ input }) => ({
        id: input.id,
        from: "approved" as const,
        changes: {
          status: "canceled",
          canceled_at: new Date(),
          canceled_by: input.staff_id,
          cancel_cause: "staff",
          cancel_reason: input.reason,
        },
      }))
    )
    when(
      "returns-cancel-medusa-exchange",
      { request },
      ({ request }) => request.kind === "exchange" && Boolean(request.exchange_id)
    ).then(() => {
      cancelOrderExchangeWorkflow.runAsStep({
        input: transform({ request, input }, ({ request, input }) => ({
          exchange_id: request.exchange_id ?? "",
          canceled_by: input.staff_id,
        })),
      })
    })
    when(
      "returns-cancel-medusa-return",
      { request },
      ({ request }) => request.kind === "return" && Boolean(request.return_id)
    ).then(() => {
      cancelReturnWorkflow.runAsStep({
        input: transform({ request, input }, ({ request, input }) => ({
          return_id: request.return_id ?? "",
          canceled_by: input.staff_id,
        })),
      })
    })
    emitEventStep({
      eventName: RETURN_REQUEST_CANCELED,
      data: transform({ canceled }, ({ canceled }) => ({
        id: canceled.id,
        order_id: canceled.order_id,
        kind: canceled.kind,
      })),
    })
    releaseLocksStep(held)
    return new WorkflowResponse(canceled)
  }
)

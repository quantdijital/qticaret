import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  emitEventStep,
  beginReturnOrderWorkflow,
  confirmReturnRequestWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows"
import { RETURN_REQUEST_APPROVED } from "./events"
import { returnsLockKey } from "../../lib/orders/locks"
import {
  readReturnRequestStep,
  returnRequestOrderStep,
  updateReturnRequestStep,
} from "./steps/return-request"
import { acquireLocksStep } from "../locking/acquire-locks"
import { releaseLocksStep } from "../locking/release-locks"

/**
 * The shop approves a return request (adr/0032): Medusa's return opened
 * for the asked lines (no shipping method: Medusa opens no carrier return
 * itself; the shopper sends the parcel back) and the request approved. A
 * step that fails undoes the ones before it. The
 * request is read under the order's returns lock: a second click finds
 * it approved already.
 */
export const approveReturnWorkflow = createWorkflow(
  "returns-approve",
  (input: { id: string; staff_id: string; note?: string | null }) => {
    const orderId = returnRequestOrderStep({ id: input.id })
    const lockKey = transform({ orderId }, ({ orderId }) => returnsLockKey(orderId))
    const held = acquireLocksStep({ key: lockKey, timeout: 10, ttl: 120 })
    const request = readReturnRequestStep({ id: input.id, status: "requested" })
    const change = beginReturnOrderWorkflow.runAsStep({
      input: transform({ request, input }, ({ request, input }) => ({
        order_id: request.order_id,
        created_by: input.staff_id,
        description: `return request ${request.id}`,
        ...(request.location_id ? { location_id: request.location_id } : {}),
      })),
    })
    const returnId = transform({ change }, ({ change }) => change.return_id)
    requestItemReturnWorkflow.runAsStep({
      input: transform({ request, returnId }, ({ request, returnId }) => ({
        return_id: returnId,
        items: request.items.map((item) => ({ id: item.line_item_id, quantity: item.quantity })),
      })),
    })
    confirmReturnRequestWorkflow.runAsStep({
      input: transform({ returnId, input }, ({ returnId, input }) => ({
        return_id: returnId,
        confirmed_by: input.staff_id,
      })),
    })
    const approved = updateReturnRequestStep(
      transform({ input, returnId }, ({ input, returnId }) => ({
        id: input.id,
        from: "requested" as const,
        changes: {
          status: "approved",
          decided_by: input.staff_id,
          decided_at: new Date(),
          decision_note: input.note ?? null,
          return_id: returnId,
        },
      }))
    )
    emitEventStep({
      eventName: RETURN_REQUEST_APPROVED,
      data: transform({ approved }, ({ approved }) => ({
        id: approved.id,
        order_id: approved.order_id,
        kind: approved.kind,
      })),
    })
    releaseLocksStep(held)
    return new WorkflowResponse(approved)
  }
)

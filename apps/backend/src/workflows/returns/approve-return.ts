import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  beginReturnOrderWorkflow,
  confirmReturnRequestWorkflow,
  releaseLockStep,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows"
import { returnsLockKey } from "./request-return"
import {
  openCarrierReturnStep,
  readReturnRequestStep,
  storeReturnLabelStep,
  updateReturnRequestStep,
} from "./steps/return-request"

/**
 * The shop approves a return request (adr/0032): Medusa's return opened
 * for the asked lines (no shipping method: Medusa opens no carrier return
 * itself), the carrier's return and its label when the order went with
 * Geliver, and the request approved with the code the shopper hands the
 * parcel over with. A step that fails undoes the ones before it.
 */
export const approveReturnWorkflow = createWorkflow(
  "returns-approve",
  (input: { id: string; staff_id: string; note?: string | null }) => {
    const request = readReturnRequestStep({ id: input.id, status: "requested" })
    const lockKey = transform({ request }, ({ request }) => returnsLockKey(request.order_id))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })
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
    const carrier = openCarrierReturnStep(
      transform({ request }, ({ request }) => ({ order_id: request.order_id }))
    )
    const label = storeReturnLabelStep(
      transform({ carrier }, ({ carrier }) => ({ source: carrier?.label_source ?? null }))
    )
    const approved = updateReturnRequestStep(
      transform({ input, returnId, carrier, label }, ({ input, returnId, carrier, label }) => ({
        id: input.id,
        status: "approved",
        decided_by: input.staff_id,
        decided_at: new Date(),
        decision_note: input.note ?? null,
        return_id: returnId,
        return_code: carrier?.code ?? null,
        return_shipment_id: carrier?.shipment_id ?? null,
        return_label_file_id: label,
      }))
    )
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(approved)
  }
)

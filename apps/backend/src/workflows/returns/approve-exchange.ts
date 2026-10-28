import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  beginExchangeOrderWorkflow,
  confirmExchangeRequestWorkflow,
  createExchangeShippingMethodWorkflow,
  markPaymentCollectionAsPaid,
  orderExchangeAddNewItemWorkflow,
  orderExchangeRequestItemReturnWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { returnsLockKey } from "../../lib/orders/locks"
import { checkExchangeStep, exchangeSettledStep, exchangeStartStep } from "./steps/exchange"
import {
  openCarrierReturnStep,
  readReturnRequestStep,
  returnRequestOrderStep,
  storeReturnLabelStep,
  updateReturnRequestStep,
} from "./steps/return-request"

/**
 * The shop approves a swap (adr/0032 §6): checked at the difference staff
 * were shown, then Medusa's exchange opened: the lines asked back, the
 * new variants added at Medusa's price, a free outbound shipping with the
 * order's option (so their stock is reserved), confirmed. What the
 * shopper owes, which staff collected, is marked paid on Medusa's payment
 * collection; what the shop owes goes back when the parcel arrives. The
 * carrier's return and its label as for a return. A step that fails
 * undoes the ones before it; under the order's returns lock.
 */
export const approveExchangeWorkflow = createWorkflow(
  "returns-approve-exchange",
  (input: { id: string; staff_id: string; note?: string | null; collected: boolean }) => {
    const orderId = returnRequestOrderStep({ id: input.id })
    const lockKey = transform({ orderId }, ({ orderId }) => returnsLockKey(orderId))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 180 })
    const request = readReturnRequestStep({ id: input.id, status: "requested" })
    const expected = checkExchangeStep(
      transform({ request, input }, ({ request, input }) => ({
        order_id: request.order_id,
        exchange_items: request.exchange_items ?? [],
        shown: request.difference,
        collected: input.collected,
      }))
    )
    const start = exchangeStartStep(
      transform({ request }, ({ request }) => ({ order_id: request.order_id }))
    )
    const change = beginExchangeOrderWorkflow.runAsStep({
      input: transform({ request, input }, ({ request, input }) => ({
        order_id: request.order_id,
        created_by: input.staff_id,
        description: `exchange request ${request.id}`,
      })),
    })
    const exchangeId = transform({ change }, ({ change }) => change.exchange_id)
    orderExchangeRequestItemReturnWorkflow.runAsStep({
      input: transform({ request, exchangeId }, ({ request, exchangeId }) => ({
        exchange_id: exchangeId,
        // Medusa's type asks for it, but the workflow opens the exchange's own return
        return_id: "",
        items: request.items.map((item) => ({ id: item.line_item_id, quantity: item.quantity })),
        ...(request.location_id ? { location_id: request.location_id } : {}),
      })),
    })
    orderExchangeAddNewItemWorkflow.runAsStep({
      input: transform({ request, exchangeId }, ({ request, exchangeId }) => ({
        exchange_id: exchangeId,
        items: (request.exchange_items ?? []).map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
        })),
      })),
    })
    // The new items' parcel is on the shop: free to the shopper
    createExchangeShippingMethodWorkflow.runAsStep({
      input: transform({ start, exchangeId }, ({ start, exchangeId }) => ({
        exchange_id: exchangeId,
        shipping_option_id: start.shipping_option_id,
        custom_amount: 0,
      })),
    })
    confirmExchangeRequestWorkflow.runAsStep({
      input: transform({ exchangeId, input }, ({ exchangeId, input }) => ({
        exchange_id: exchangeId,
        confirmed_by: input.staff_id,
      })),
    })
    const settled = exchangeSettledStep(
      transform(
        { request, exchangeId, start, expected },
        ({ request, exchangeId, start, expected }) => ({
          order_id: request.order_id,
          exchange_id: exchangeId,
          pending_before: start.pending,
          expected,
          returned: request.items,
        })
      )
    )
    const carrier = openCarrierReturnStep(
      transform({ request }, ({ request }) => ({
        order_id: request.order_id,
        items: request.items,
      }))
    )
    const label = storeReturnLabelStep(
      transform({ carrier }, ({ carrier }) => ({ source: carrier?.label_source ?? null }))
    )
    when(
      "returns-exchange-collected",
      { settled },
      ({ settled }) => settled.difference > 0 && settled.payment_collection_id !== null
    ).then(() => {
      markPaymentCollectionAsPaid.runAsStep({
        input: transform({ request, settled, input }, ({ request, settled, input }) => ({
          payment_collection_id: settled.payment_collection_id ?? "",
          order_id: request.order_id,
          captured_by: input.staff_id,
        })),
      })
    })
    const approved = updateReturnRequestStep(
      transform(
        { input, exchangeId, settled, carrier, label },
        ({ input, exchangeId, settled, carrier, label }) => ({
          id: input.id,
          from: "requested" as const,
          changes: {
            status: "approved",
            decided_by: input.staff_id,
            decided_at: new Date(),
            decision_note: input.note ?? null,
            exchange_id: exchangeId,
            return_id: settled.return_id,
            difference: settled.difference,
            return_code: carrier?.code ?? null,
            return_shipment_id: carrier?.shipment_id ?? null,
            return_label_file_id: label,
          },
        })
      )
    )
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(approved)
  }
)

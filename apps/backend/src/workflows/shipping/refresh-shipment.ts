import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createOrderShipmentWorkflow,
  emitEventStep,
  markOrderFulfillmentAsDeliveredWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import {
  readCarrierStatusStep,
  readTrackedShipmentStep,
  recordShipmentStatusStep,
} from "./steps/track"

/** Fired when a parcel moves on (adr/0031): the customer's notice hangs off it (F9). */
export const SHIPMENT_STATUS_CHANGED = "shipment.status_changed"

/**
 * Asks the carrier where a tracked parcel is and records it (F7.5–F7.6,
 * adr/0031), for a notification and the job alike, under the parcel's
 * lock: the same move is recorded once, however it is learnt. Once the
 * carrier has the parcel the order is handed over (Medusa's shipment, with
 * the tracking number); once delivered, Medusa's delivery is recorded.
 */
export const refreshShipmentWorkflow = createWorkflow(
  "shipping-refresh-shipment",
  (input: { tracked_shipment_id: string }) => {
    const lockKey = transform(
      { input },
      ({ input }) => `shipping:track:${input.tracked_shipment_id}`
    )
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 60 })
    const tracked = readTrackedShipmentStep(input.tracked_shipment_id)
    const reading = readCarrierStatusStep(tracked)
    const change = recordShipmentStatusStep({ tracked, reading })

    when("shipping-hand-over", { change }, ({ change }) => change.hand_over).then(() => {
      createOrderShipmentWorkflow.runAsStep({
        input: transform({ tracked, change }, ({ tracked, change }) => ({
          order_id: tracked.order_id,
          fulfillment_id: tracked.fulfillment_id,
          items: tracked.items,
          labels: change.tracking_number
            ? [
                {
                  tracking_number: change.tracking_number,
                  tracking_url: change.tracking_url ?? "",
                  label_url: "",
                },
              ]
            : [],
        })),
      })
    })
    when("shipping-delivered", { change }, ({ change }) => change.deliver).then(() => {
      markOrderFulfillmentAsDeliveredWorkflow.runAsStep({
        input: transform({ tracked }, ({ tracked }) => ({
          orderId: tracked.order_id,
          fulfillmentId: tracked.fulfillment_id,
        })),
      })
    })
    when("shipping-status-changed", { change }, ({ change }) => change.moved).then(() => {
      emitEventStep({
        eventName: SHIPMENT_STATUS_CHANGED,
        data: transform({ tracked, change }, ({ tracked, change }) => ({
          id: tracked.id,
          order_id: tracked.order_id,
          fulfillment_id: tracked.fulfillment_id,
          status: change.status,
        })),
      })
    })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(change)
  }
)

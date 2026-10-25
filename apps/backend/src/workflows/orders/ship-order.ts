import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { planShipmentStep } from "./steps/plan-shipment"

export interface ShipOrderInput {
  order_id: string
  /** Tell the customer (Medusa's no_notification, inverted). */
  notify: boolean
  /** The staff member, recorded on the shipment. */
  created_by?: string | undefined
}

/**
 * "Kargoya ver" as one step for the shop (adr/0022): the parcel is packed
 * (a fulfillment, unless one is already packed) and handed over (its
 * shipment). Both are Medusa's workflows run as steps, so a failed
 * shipment undoes the packing and the order is never left half done. A
 * lock per order keeps two clicks from packing twice.
 */
export const shipOrderWorkflow = createWorkflow("orders-ship-order", (input: ShipOrderInput) => {
  const lockKey = transform({ input }, ({ input }) => `orders:ship:${input.order_id}`)
  acquireLockStep({ key: lockKey, timeout: 10, ttl: 60 })

  const plan = planShipmentStep({ order_id: input.order_id })

  const packed = when({ plan }, ({ plan }) => plan.fulfillment_id === null).then(() =>
    createOrderFulfillmentWorkflow.runAsStep({
      input: transform({ input, plan }, ({ input, plan }) => ({
        order_id: input.order_id,
        items: plan.items,
        no_notification: !input.notify,
        ...(input.created_by ? { created_by: input.created_by } : {}),
      })),
    })
  )

  const shipment = transform({ input, plan, packed }, ({ input, plan, packed }) => ({
    order_id: input.order_id,
    fulfillment_id: plan.fulfillment_id ?? packed?.id ?? "",
    items: plan.items,
    no_notification: !input.notify,
    ...(input.created_by ? { created_by: input.created_by } : {}),
  }))
  createOrderShipmentWorkflow.runAsStep({ input: shipment })

  releaseLockStep({ key: lockKey })
  return new WorkflowResponse({ order_id: input.order_id })
})

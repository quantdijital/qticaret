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
import { shipLockKey } from "../../lib/orders/locks"
import { SHIP_ROUTE_MARK } from "../../lib/shipping/carriers"
import { ensureGeliverSenderStep } from "../shipping/steps/geliver-sender"
import { planCarrierStep } from "../shipping/steps/plan-carrier"
import { forgetLabelSourceStep, storeShipmentLabelStep } from "../shipping/steps/store-label"
import { trackShipmentStep } from "../shipping/steps/track"
import { planShipmentStep } from "./steps/plan-shipment"

export interface ShipOrderInput {
  order_id: string
  /** Tell the customer (Medusa's no_notification, inverted). */
  notify: boolean
  /** The staff member, recorded on the shipment. */
  created_by?: string | undefined
  /** A part of what is left (F7.10); the whole of it when absent. */
  items?: { id: string; quantity: number }[] | undefined
}

/**
 * "Kargoya ver" as one step for the shop (adr/0022): the parcel is packed
 * (a fulfillment, unless one is already packed) and handed over (its
 * shipment). Both are Medusa's workflows run as steps, so a failed
 * shipment undoes the packing and the order is never left half done. A
 * lock per order keeps two clicks from packing twice.
 *
 * With a carrier (Geliver from the warehouse's sender address, adr/0031;
 * the shop's own contract, adr/0035) packing opens the shipment there,
 * gets its label and keeps it privately; the order is handed over when
 * the carrier picks the parcel up (its tracking), not here: such a parcel
 * is not offered for shipping again (`orderState().pickup`).
 */
export const shipOrderWorkflow = createWorkflow("orders-ship-order", (input: ShipOrderInput) => {
  const lockKey = transform({ input }, ({ input }) => shipLockKey(input.order_id))
  // Long enough for a carrier: offers, the label's purchase and its download
  acquireLockStep({ key: lockKey, timeout: 10, ttl: 180 })

  const plan = planShipmentStep(
    transform({ input }, ({ input }) => ({ order_id: input.order_id, items: input.items }))
  )
  const carrier = planCarrierStep(
    transform({ input }, ({ input }) => ({
      order_id: input.order_id,
      partial: Boolean(input.items),
    }))
  )

  const sender = when(
    "shipping-geliver-sender",
    { carrier, plan },
    ({ carrier, plan }) => carrier.carrier === "geliver" && plan.fulfillment_id === null
  ).then(() => ensureGeliverSenderStep({ location_id: carrier.location_id }))

  const packed = when({ plan }, ({ plan }) => plan.fulfillment_id === null).then(() =>
    createOrderFulfillmentWorkflow.runAsStep({
      input: transform({ input, plan, carrier, sender }, ({ input, plan, carrier, sender }) => ({
        order_id: input.order_id,
        items: plan.items,
        no_notification: !input.notify,
        // Kept on the parcel: a carrier hands it over later, when the customer's notice goes (F9)
        metadata: { qt_notify: input.notify },
        ...(input.created_by ? { created_by: input.created_by } : {}),
        ...(carrier.location_id ? { location_id: carrier.location_id } : {}),
        // Our route's mark: a carrier provider opens no shipment without it
        ...(carrier.carrier
          ? {
              additional_data: {
                [SHIP_ROUTE_MARK]: {
                  sender_address_id: sender?.sender_address_id ?? null,
                  cash_on_delivery: carrier.cash_on_delivery,
                },
              },
            }
          : {}),
      })),
    })
  )

  when(
    "shipping-carrier-label",
    { carrier, packed },
    ({ carrier, packed }) => carrier.carrier !== null && Boolean(packed?.id)
  ).then(() => {
    const fulfillment = transform({ input, packed }, ({ input, packed }) => ({
      fulfillment_id: packed?.id ?? "",
      order_id: input.order_id,
    }))
    forgetLabelSourceStep(fulfillment)
    storeShipmentLabelStep(fulfillment)
    trackShipmentStep(fulfillment)
  })

  when("orders-ship-hand-over", { carrier }, ({ carrier }) => carrier.carrier === null).then(() => {
    const shipment = transform({ input, plan, packed }, ({ input, plan, packed }) => ({
      order_id: input.order_id,
      fulfillment_id: plan.fulfillment_id ?? packed?.id ?? "",
      items: plan.items,
      no_notification: !input.notify,
      ...(input.created_by ? { created_by: input.created_by } : {}),
    }))
    createOrderShipmentWorkflow.runAsStep({ input: shipment })
  })

  releaseLockStep({ key: lockKey })
  return new WorkflowResponse(
    transform({ input, carrier, plan, packed }, ({ input, carrier, plan, packed }) => ({
      order_id: input.order_id,
      carrier: carrier.carrier,
      fulfillment_id: plan.fulfillment_id ?? packed?.id ?? null,
    }))
  )
})

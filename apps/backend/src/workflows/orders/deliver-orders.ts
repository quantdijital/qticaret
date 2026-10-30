import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows"
import { serverErrorMessage } from "../../lib/errors/messages"
import { errorSummary, logger } from "../../lib/logging"
import { shipLockKey } from "../../lib/orders/locks"
import { carrierOf } from "../../lib/shipping/carriers"

export interface DeliverResult {
  order_id: string
  ok: boolean
  /** Parcels marked delivered. */
  delivered: number
  /** Why not: the i18n key, and its sentence for the panel. */
  error: string | null
  message: string | null
}

interface FulfillmentRow {
  id: string
  provider_id?: string | null
  shipped_at?: string | Date | null
  delivered_at?: string | Date | null
  canceled_at?: string | Date | null
}

/** The orders' parcels still to mark delivered: handed over, not delivered, the shop's own. */
async function parcelsToDeliver(
  container: MedusaContainer,
  ids: string[]
): Promise<Map<string, FulfillmentRow[]>> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "id",
      "fulfillments.id",
      "fulfillments.provider_id",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
    ],
    filters: { id: ids },
  })
  return new Map(
    (data as { id: string; fulfillments?: (FulfillmentRow | null)[] | null }[]).map((order) => [
      order.id,
      (order.fulfillments ?? []).filter(
        (row): row is FulfillmentRow =>
          row !== null &&
          Boolean(row.shipped_at) &&
          !row.delivered_at &&
          !row.canceled_at &&
          carrierOf(row.provider_id) === null
      ),
    ])
  )
}

/**
 * "Teslim edildi" for several orders (F12.3): each one's parcels handed
 * over and not yet delivered, of the shop's own delivery only. A carrier's
 * parcel is delivered by its tracking (adr/0031); marked by hand, the
 * carrier's later "delivered" would find it done. One order failing does
 * not stop the rest.
 */
export async function deliverOrders(
  container: MedusaContainer,
  orderIds: string[]
): Promise<DeliverResult[]> {
  const ids = [...new Set(orderIds)]
  const orders = await parcelsToDeliver(container, ids)
  const results: DeliverResult[] = []
  for (const orderId of ids) {
    const parcels = orders.get(orderId)
    if (!parcels?.length) {
      const key = parcels ? "orders.nothing_to_deliver" : "orders.unknown"
      results.push({
        order_id: orderId,
        ok: false,
        delivered: 0,
        error: key,
        message: serverErrorMessage(key, "tr"),
      })
      continue
    }
    let delivered = 0
    try {
      // Under the order's ship lock, read again: two people marking it at once deliver it once
      await container.resolve(Modules.LOCKING).execute(shipLockKey(orderId), async () => {
        for (const parcel of (await parcelsToDeliver(container, [orderId])).get(orderId) ?? []) {
          await markOrderFulfillmentAsDeliveredWorkflow(container).run({
            input: { orderId, fulfillmentId: parcel.id },
          })
          delivered += 1
        }
      })
      results.push({ order_id: orderId, ok: true, delivered, error: null, message: null })
    } catch (error) {
      logger.warn({ event: "orders.bulk_deliver_failed", orderId, err: errorSummary(error) })
      results.push({
        order_id: orderId,
        ok: false,
        delivered,
        error: "orders.deliver_failed",
        message: serverErrorMessage("orders.deliver_failed", "tr"),
      })
    }
  }
  return results
}

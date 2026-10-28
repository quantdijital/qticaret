import type { MedusaContainer } from "@medusajs/framework/types"
import { I18N_KEY } from "../../lib/errors/http"
import { serverErrorMessage } from "../../lib/errors/messages"
import { errorSummary, logger } from "../../lib/logging"
import { shipOrderWorkflow } from "./ship-order"

export interface ShipResult {
  order_id: string
  ok: boolean
  carrier: "geliver" | null
  /** A carrier's parcel waiting for its pickup: its label to print. */
  fulfillment_id: string | null
  /** Why it was not shipped: the error's i18n key, and its sentence for the panel. */
  error: string | null
  message: string | null
}

// Only an i18n key as our errors and Medusa's carry them (`orders.unknown`), never other text
const keyOf = (error: unknown): string => {
  const { safeMessage, message } = (error ?? {}) as { safeMessage?: unknown; message?: unknown }
  const key = typeof safeMessage === "string" ? safeMessage : message
  return typeof key === "string" && I18N_KEY.test(key) ? key : "orders.ship_failed"
}

/**
 * "Kargoya ver" for several orders (F7.7), one after another, each its
 * own workflow: one that cannot ship (an address, a payment awaited) is
 * reported and the rest go on. Carriers are asked one order at a time.
 */
export async function shipOrders(
  container: MedusaContainer,
  input: { order_ids: string[]; notify: boolean; created_by?: string | undefined }
): Promise<ShipResult[]> {
  const results: ShipResult[] = []
  for (const orderId of [...new Set(input.order_ids)]) {
    try {
      const { result } = await shipOrderWorkflow(container).run({
        input: { order_id: orderId, notify: input.notify, created_by: input.created_by },
      })
      results.push({
        order_id: orderId,
        ok: true,
        carrier: result.carrier,
        fulfillment_id: result.carrier ? result.fulfillment_id : null,
        error: null,
        message: null,
      })
    } catch (error) {
      logger.warn({ event: "orders.bulk_ship_failed", orderId, err: errorSummary(error) })
      const key = keyOf(error)
      results.push({
        order_id: orderId,
        ok: false,
        carrier: null,
        fulfillment_id: null,
        error: key,
        message: serverErrorMessage(key, "tr"),
      })
    }
  }
  return results
}

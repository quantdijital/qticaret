import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import type { FilledReservations } from "../fill-reservations"

/** The log line and audit entry of a fill. */
export const RESERVATION_FILLED = "order.reservation_filled"

/**
 * Records what "Kargoya ver" held for a parcel that went (adr/0054,
 * 2026-11-05 addendum): an info log line and a system audit entry on the
 * order, naming the warehouse, the levels made and each line's hold. Run
 * once the parcel is packed and handed on, so only a fill that stayed is
 * recorded. Neither may fail the shipment: an audit write that fails is
 * logged and passed.
 */
export const noteFilledReservationsStep = createStep(
  "orders-note-filled-reservations",
  async (
    input: { order_id: string; actor_id: string | null; filled: FilledReservations },
    { container }
  ) => {
    const { location_id, levels, lines } = input.filled
    logger.info({
      event: RESERVATION_FILLED,
      orderId: input.order_id,
      locationId: location_id,
      levels,
      lines,
    })
    try {
      await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
        kind: "system",
        action: RESERVATION_FILLED,
        actor_type: input.actor_id ? "user" : "system",
        actor_id: input.actor_id,
        resource_type: "order",
        resource_id: input.order_id,
        outcome: 200,
        changes: { location_id, levels, lines },
      })
    } catch (error) {
      logger.warn({ event: "orders.reservation_audit_failed", err: errorSummary(error) })
    }
    return new StepResponse(undefined)
  }
)

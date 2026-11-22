import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { BOOKING_MODULE } from "../../modules/booking"
import type BookingModuleService from "../../modules/booking/service"
import { alertTravelersAttachFailed } from "./confirm-alert"
import { moveOrderTravelers } from "./orders"
import { RECONCILE_PAGE, RECONCILE_SETTLE_MINUTES } from "./reconcile"
import { RECONCILE_MAX_ATTEMPTS, reconcileAttempts } from "./reconcile-attempts"
import type { ReconcileAttempts } from "./reconcile-attempts"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Bookings whose order's cart still has travelers not attached
 * (adr/0076 §7): the confirmation wrote the booking, then its travelers
 * failed to follow (`attachOrderTravelers` logs and goes on). Once
 * attached, a cart has none left unattached (the attachment deletes what
 * the booking does not keep), so any found here is a miss. Fresh bookings
 * are left to their own confirmation; one whose bell already rang is left
 * to staff.
 */
export const UNATTACHED_TRAVELERS = `SELECT b.order_id, max(b.created_at) AS last
  FROM booking b
  JOIN order_cart oc ON oc.order_id = b.order_id AND oc.deleted_at IS NULL
 WHERE b.deleted_at IS NULL
   AND b.created_at <= now() - make_interval(mins => ?)
   AND EXISTS (
         SELECT 1 FROM booking_traveler t
          WHERE t.cart_id = oc.cart_id AND t.booking_id IS NULL AND t.deleted_at IS NULL)
   AND NOT EXISTS (
         SELECT 1 FROM notification n
          WHERE n.resource_id = b.order_id AND n.trigger_type = 'booking.travelers_attach_failed')
 GROUP BY b.order_id
 ORDER BY last DESC, b.order_id DESC
 LIMIT ?`

/** The order's booking given its cart's travelers; how many, 0 when it has no booking. */
export const attachTravelersStep = createStep(
  "booking-attach-travelers",
  async (input: { order_id: string }, { container }) => {
    const service = container.resolve<BookingModuleService>(BOOKING_MODULE)
    const [booking] = await service.listBookings({ order_id: input.order_id }, { take: 1 })
    return new StepResponse(
      booking ? await moveOrderTravelers(container, input.order_id, booking.id) : 0
    )
  }
)

/** Under the order's lock, as its confirmation and cancel: never beside them. */
export const attachTravelersWorkflow = createWorkflow(
  "booking-attach-travelers",
  (input: { order_id: string }) => {
    const key = transform({ input }, ({ input }) => `booking:order:${input.order_id}`)
    acquireLockStep({ key, timeout: 10, ttl: 30 })
    const attached = attachTravelersStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(attached)
  }
)

export interface TravelerReconcileCounts {
  attached: number
  failed: number
  /** Left alone after `RECONCILE_MAX_ATTEMPTS` failed tries; its bell rang. */
  given_up: number
}

export interface TravelerReconcileActions {
  attach: (orderId: string) => Promise<unknown>
  /** Rung once, when an order's last try fails. */
  alert: (orderId: string) => Promise<void>
}

const workflowActions = (container: Container): TravelerReconcileActions => ({
  attach: (orderId) =>
    attachTravelersWorkflow(container as MedusaContainer).run({ input: { order_id: orderId } }),
  alert: (orderId) => alertTravelersAttachFailed(container, orderId),
})

// Its own tries, apart from the order's confirm and cancel tries
const attemptKey = (orderId: string) => `travelers:${orderId}`

/**
 * Travelers a booking's confirmation failed to attach, attached again (a
 * page, newest first), each under its order's lock. An order that keeps
 * failing is tried `RECONCILE_MAX_ATTEMPTS` times; the last failure rings
 * the panel's bell (`booking.travelers_attach_failed`), which keeps it out
 * of later runs. Ids only in the log.
 */
export async function reconcileTravelers(
  container: Container,
  actions: TravelerReconcileActions = workflowActions(container),
  attempts: ReconcileAttempts = reconcileAttempts()
): Promise<TravelerReconcileCounts> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const counts: TravelerReconcileCounts = { attached: 0, failed: 0, given_up: 0 }
  const result = await knex.raw<{ rows: { order_id: string }[] }>(UNATTACHED_TRAVELERS, [
    RECONCILE_SETTLE_MINUTES,
    RECONCILE_PAGE,
  ])
  for (const { order_id: orderId } of result.rows) {
    const key = attemptKey(orderId)
    const before = await attempts.count(key).catch(() => 0)
    if (before >= RECONCILE_MAX_ATTEMPTS) {
      counts.given_up += 1
      continue
    }
    try {
      await actions.attach(orderId)
      counts.attached += 1
      if (before > 0) {
        await attempts.clear(key).catch(() => undefined)
      }
    } catch (error) {
      counts.failed += 1
      const now = await attempts.fail(key).catch(() => before + 1)
      logger.warn({
        event: "booking.travelers_reattach_failed",
        order_id: orderId,
        tries: now,
        err: errorSummary(error),
      })
      if (now >= RECONCILE_MAX_ATTEMPTS) {
        await actions.alert(orderId)
      }
    }
  }
  return counts
}

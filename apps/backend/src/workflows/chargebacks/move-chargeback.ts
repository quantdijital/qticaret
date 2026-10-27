import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, emitEventStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import type { ChargebackStatus } from "../../modules/chargebacks/states"
import { moveChargebackStep } from "./steps/chargeback"

/** Fired when a dispute is lost: the accounting entry hangs off it (F11). */
export const CHARGEBACK_LOST = "chargeback.lost"

/**
 * Moves a dispute on: evidence sent, then won or lost (adr/0030). A lost
 * one is announced for the books; the order's refund ledger is not
 * touched: the bank took the money back, the shop did not refund it.
 * Under the dispute's lock: two moves at once do not both pass.
 */
export const moveChargebackWorkflow = createWorkflow(
  "chargebacks-move",
  (input: { id: string; status: ChargebackStatus; note?: string | null }) => {
    const lockKey = transform({ input }, ({ input }) => `chargebacks:${input.id}`)
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })
    const chargeback = moveChargebackStep(input)
    when("chargebacks-lost", { input }, ({ input }) => input.status === "lost").then(() => {
      emitEventStep({
        eventName: CHARGEBACK_LOST,
        data: transform({ chargeback }, ({ chargeback }) => ({
          id: chargeback.id,
          order_id: chargeback.order_id,
          amount: chargeback.amount,
          currency_code: chargeback.currency_code,
        })),
      })
    })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(chargeback)
  }
)

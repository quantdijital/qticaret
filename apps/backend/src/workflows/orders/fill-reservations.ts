import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryLevelsWorkflow,
  createReservationsWorkflow,
  updateReservationsWorkflow,
} from "@medusajs/medusa/core-flows"
import type { FilledLine } from "../../lib/shipping/reservations"
import { planReservationsStep } from "./steps/plan-reservations"
import type { PlanReservationsInput } from "./steps/plan-reservations"

/** What "Kargoya ver" held for a parcel: for its log line and audit entry. */
export interface FilledReservations {
  location_id: string
  /** Items the warehouse got a level for, at 0. */
  levels: string[]
  lines: FilledLine[]
}

/**
 * Holds what the parcel's tracked lines lack before Medusa packs it
 * (adr/0054, 2026-11-05 addendum; `lib/shipping/reservations`): the
 * warehouse's missing levels at 0, missing reservations made, short ones
 * raised. Each part is Medusa's own workflow, so each undoes itself when
 * the shipment fails after it (the made reservation and level deleted,
 * the raised one put back) and the stock ledger hears of it as of any
 * reservation.
 */
export const fillReservationsWorkflow = createWorkflow(
  "orders-fill-reservations",
  (input: WorkflowData<PlanReservationsInput>) => {
    const fill = planReservationsStep(input)

    when("orders-fill-reservations-levels", { fill }, ({ fill }) => fill.levels.length > 0).then(
      () => {
        createInventoryLevelsWorkflow.runAsStep({
          input: transform({ fill }, ({ fill }) => ({ inventory_levels: fill.levels })),
        })
      }
    )
    when("orders-fill-reservations-create", { fill }, ({ fill }) => fill.create.length > 0).then(
      () => {
        createReservationsWorkflow.runAsStep({
          input: transform({ fill }, ({ fill }) => ({ reservations: fill.create })),
        })
      }
    )
    when("orders-fill-reservations-raise", { fill }, ({ fill }) => fill.raise.length > 0).then(
      () => {
        updateReservationsWorkflow.runAsStep({
          input: transform({ fill }, ({ fill }) => ({ updates: fill.raise })),
        })
      }
    )

    return new WorkflowResponse(
      transform({ fill }, ({ fill }): FilledReservations => ({
        location_id: fill.location_id,
        levels: fill.levels.map((level) => level.inventory_item_id),
        lines: fill.lines,
      }))
    )
  }
)

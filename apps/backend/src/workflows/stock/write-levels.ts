import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  adjustInventoryLevelsStep,
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { checkLowStockStep } from "./steps/check-low-stock"
import { recordStockLevelsStep } from "./steps/record-stock-levels"

export interface LevelQuantity {
  inventory_item_id: string
  location_id: string
  stocked_quantity: number
}

/** A level moved by a number, not set to one (bulk edit's add and remove). */
export interface LevelAdjustment {
  inventory_item_id: string
  location_id: string
  adjustment: number
}

export interface WriteStockLevelsInput {
  /** Levels the item does not have at the location yet, and ones it has. */
  create: LevelQuantity[]
  update: LevelQuantity[]
  /** Moved under the item's lock, as Medusa's own adjustments are: a sale in between stays. */
  adjust?: LevelAdjustment[]
  reason: "import" | "bulk_edit"
  /** The job that wrote them. */
  reference: string | null
  actor_id: string | null
}

/**
 * Stock quantities our own writers set (an import, bulk edit), through
 * Medusa's level workflows, then the stock ledger's row with the writer's
 * reason and actor (adr/0020), and the low-stock check. Recorded before the
 * levels' events go out, so the ledger's subscriber finds nothing left to
 * write for them.
 */
export const writeStockLevelsWorkflow = createWorkflow(
  "stock-write-levels",
  (input: WorkflowData<WriteStockLevelsInput>) => {
    when("stock-write-create", { input }, ({ input }) => input.create.length > 0).then(() => {
      createInventoryLevelsWorkflow.runAsStep({
        input: transform({ input }, ({ input }) => ({ inventory_levels: input.create })),
      })
    })
    when("stock-write-update", { input }, ({ input }) => input.update.length > 0).then(() => {
      updateInventoryLevelsWorkflow.runAsStep({
        input: transform({ input }, ({ input }) => ({ updates: input.update })),
      })
    })
    when("stock-write-adjust", { input }, ({ input }) => (input.adjust ?? []).length > 0).then(
      () => {
        adjustInventoryLevelsStep(transform({ input }, ({ input }) => input.adjust ?? []))
      }
    )
    // The levels are written: the ledger and the alert must not undo them. A
    // row that fails is written by the levels' events or the nightly reconcile
    const movements = recordStockLevelsStep(
      transform({ input }, ({ input }) => ({
        levels: [...input.create, ...input.update, ...(input.adjust ?? [])].map(
          ({ inventory_item_id, location_id }) => ({ inventory_item_id, location_id })
        ),
        reason: input.reason,
        reference: input.reference,
        actor_id: input.actor_id,
      }))
    ).config({ name: "stock-write-record", continueOnPermanentFailure: true })
    checkLowStockStep(
      // A step that failed past (continueOnPermanentFailure) gives nothing
      transform(
        { movements },
        ({ movements }: { movements: { inventory_item_id: string }[] | undefined }) =>
          (movements ?? []).map((each) => each.inventory_item_id)
      )
    ).config({ name: "stock-write-low-stock", continueOnPermanentFailure: true })
    return new WorkflowResponse(movements)
  }
)

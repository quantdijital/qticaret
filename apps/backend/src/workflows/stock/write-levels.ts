import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from "@medusajs/medusa/core-flows"
import { recordStockWorkflow } from "./ledger"

export interface LevelQuantity {
  inventory_item_id: string
  location_id: string
  stocked_quantity: number
}

export interface WriteStockLevelsInput {
  /** Levels the item does not have at the location yet, and ones it has. */
  create: LevelQuantity[]
  update: LevelQuantity[]
  reason: "import" | "bulk_edit"
  /** The job that wrote them. */
  reference: string | null
  actor_id: string | null
}

/**
 * Stock quantities our own writers set (an import, bulk edit), through
 * Medusa's level workflows, then the stock ledger's row with the writer's
 * reason and actor (adr/0020). Recorded before the levels' events go out,
 * so the ledger's subscriber finds nothing left to write for them.
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
    const recorded = recordStockWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        levels: [...input.create, ...input.update].map(({ inventory_item_id, location_id }) => ({
          inventory_item_id,
          location_id,
        })),
        reason: input.reason,
        reference: input.reference,
        actor_id: input.actor_id,
      })),
    })
    return new WorkflowResponse(recorded)
  }
)

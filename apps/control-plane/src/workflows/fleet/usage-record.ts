import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { UsageReport } from "@qticaret/types/control-plane"
import { fleetIn } from "../modules"
import { undoableStep } from "../undoable"

export interface RecordUsageInput {
  report: UsageReport
  received_at: Date
}

const recordStep = undoableStep(
  "cp-usage-record",
  async (
    input: RecordUsageInput,
    container
  ): Promise<{ output: { stored: boolean }; undo: string | null }> => {
    const result = await fleetIn(container).recordUsage(input.report, input.received_at)
    return result.stored
      ? { output: { stored: true }, undo: result.id }
      : { output: { stored: false }, undo: null }
  },
  async (id: string | null, container) => {
    if (id) {
      await fleetIn(container).removeUsageSnapshot(id)
    }
  }
)

/**
 * A shop's usage report stored as a snapshot (adr/0061 §5.4, Ek C13),
 * after the route checked its signature, schema, shop and time: stored
 * only when it is newer than every snapshot the shop has (under the shop's
 * lock); `stored: false` otherwise. Totals only, nothing personal: no
 * execution record is kept anyway (`store: false`).
 */
export const recordUsageWorkflow = createWorkflow(
  { name: "cp-usage-record", store: false },
  (input: WorkflowData<RecordUsageInput>) => new WorkflowResponse(recordStep(input))
)

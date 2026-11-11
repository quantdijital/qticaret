import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { UsageReport } from "@qticaret/types/control-plane"
import { fleetIn } from "../modules"
import { undoableStep } from "../undoable"

export interface RecordUsageInput {
  report: UsageReport
  /** ISO time (a workflow's input crosses as JSON: a Date would arrive as text). */
  received_at: string
}

export interface RecordUsageOutput {
  stored: boolean
  /** Why not: `out_of_order` (not newer than the latest) or `too_soon` (one in the last ten minutes). */
  reason: "out_of_order" | "too_soon" | null
}

const recordStep = undoableStep(
  "cp-usage-record",
  async (
    input: RecordUsageInput,
    container
  ): Promise<{ output: RecordUsageOutput; undo: string | null }> => {
    const result = await fleetIn(container).recordUsage(input.report, new Date(input.received_at))
    return result.stored
      ? { output: { stored: true, reason: null }, undo: result.id }
      : { output: { stored: false, reason: result.reason }, undo: null }
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
 * only when it is newer than every snapshot the shop has and none came in
 * the last ten minutes (under the shop's lock); `stored: false` and why
 * otherwise. Totals only, nothing personal: no
 * execution record is kept anyway (`store: false`).
 */
export const recordUsageWorkflow = createWorkflow(
  { name: "cp-usage-record", store: false },
  (input: WorkflowData<RecordUsageInput>) => new WorkflowResponse(recordStep(input))
)

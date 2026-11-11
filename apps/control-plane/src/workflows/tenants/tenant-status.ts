import { MedusaError } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { MOVE_REASON_CODES, MOVE_STARTS, moveTarget } from "../../lib/tenants/status-moves"
import type { ManualStatusMove } from "../../lib/tenants/status-moves"
import { withBillingLock } from "../../lib/billing/lock"
import { overdueToday } from "../../lib/billing/overdue"
import { tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

export interface TenantStatusMoveInput {
  tenant_id: string
  move: ManualStatusMove
  /** The staff member's user id, or `system` (a terminal's command). */
  actor: string
  /** Why, in the staff member's words: kept on the status row. */
  note: string
}

interface Moved {
  from: TenantStatus
  to: TenantStatus
  change_id: string
}

const moveStep = undoableStep(
  "cp-tenant-status-move",
  async (input: TenantStatusMoveInput, container) =>
    // Ek C16 review M1: a suspension's end reads the payments under the shop's
    // billing lock, so no billing change lands between the reading and the move
    await withBillingLock(container, input.tenant_id, async () => {
      const tenants = tenantsIn(container)
      const tenant = await tenants.tenantOf(input.tenant_id)
      const overdue =
        input.move === "resume" ? await overdueToday(container, input.tenant_id, new Date()) : false
      const to = moveTarget(input.move, tenant.status, overdue)
      if (to === null) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.status_transition")
      }
      const moved = await tenants.changeStatus(input.tenant_id, to, {
        reason_code: MOVE_REASON_CODES[input.move],
        actor: input.actor,
        note: input.note,
        // Checked again under the row's lock: a move made meanwhile refuses this one
        from: MOVE_STARTS[input.move],
      })
      return { output: moved, undo: { tenant_id: input.tenant_id, ...moved } }
    }),
  async (undo: Moved & { tenant_id: string }, container) => {
    await tenantsIn(container).undoStatusChange(undo.tenant_id, undo)
  }
)

/**
 * A shop suspended or its suspension ended (adr/0061 §2, Ek C15), along
 * the contract's transitions, with its status row. Its plan document is
 * issued again by the caller, after this.
 */
export const moveTenantStatusWorkflow = createWorkflow(
  { name: "cp-tenant-status-move", store: false },
  (input: WorkflowData<TenantStatusMoveInput>) => new WorkflowResponse(moveStep(input))
)

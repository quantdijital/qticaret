import { MedusaError } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { MOVE_REASON_CODES, moveTarget } from "../../lib/tenants/status-moves"
import type { ManualStatusMove } from "../../lib/tenants/status-moves"
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
  async (input: TenantStatusMoveInput, container) => {
    const tenants = tenantsIn(container)
    const tenant = await tenants.tenantOf(input.tenant_id)
    const before =
      input.move === "resume" ? await tenants.statusBeforeSuspension(input.tenant_id) : null
    const to = moveTarget(input.move, tenant.status, before)
    if (to === null) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.status_transition")
    }
    const moved = await tenants.changeStatus(input.tenant_id, to, {
      reason_code: MOVE_REASON_CODES[input.move],
      actor: input.actor,
      note: input.note,
    })
    return { output: moved, undo: { tenant_id: input.tenant_id, ...moved } }
  },
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

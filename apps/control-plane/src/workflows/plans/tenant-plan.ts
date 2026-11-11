import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { LimitKey } from "@qticaret/types/control-plane"
import type { FeatureOverrideRecord, OverrideRecord } from "../../modules/plans/types"
import { plansIn } from "../modules"
import { undoableStep } from "../undoable"

export interface AssignPlanInput {
  tenant_id: string
  package_id: string | null
  by: string | null
}

const assignStep = undoableStep(
  "cp-tenant-assign-plan",
  async (input: AssignPlanInput, container) => {
    const { before } = await plansIn(container).assignPlan(
      input.tenant_id,
      input.package_id,
      input.by
    )
    return {
      output: { from: before, to: input.package_id },
      undo: { tenant_id: input.tenant_id, package_id: before },
    }
  },
  async (undo: { tenant_id: string; package_id: string | null }, container) => {
    await plansIn(container).assignPlan(undo.tenant_id, undo.package_id, null)
  }
)

/** A shop put on a package; an archived one takes no new shop (adr/0061 §2). */
export const assignPlanWorkflow = createWorkflow(
  { name: "cp-tenant-assign-plan", store: false },
  (input: WorkflowData<AssignPlanInput>) => new WorkflowResponse(assignStep(input))
)

export interface SetOverrideInput {
  tenant_id: string
  key: LimitKey
  /** Null removes the exception. */
  override: {
    value: number | null
    reason: string
    expires_at: Date | null
    created_by: string | null
  } | null
}

const setOverrideStep = undoableStep(
  "cp-tenant-set-override",
  async (input: SetOverrideInput, container) => {
    const { before } = await plansIn(container).setOverride(
      input.tenant_id,
      input.key,
      input.override
    )
    return {
      output: before,
      undo: { tenant_id: input.tenant_id, key: input.key, before },
    }
  },
  async (undo: { tenant_id: string; key: LimitKey; before: OverrideRecord | null }, container) => {
    const { before } = undo
    await plansIn(container).setOverride(
      undo.tenant_id,
      undo.key,
      before
        ? {
            value: before.value,
            reason: before.reason,
            expires_at: before.expires_at,
            created_by: before.created_by,
          }
        : null
    )
  }
)

/** A shop's exception for one limit set or removed, with its reason (adr/0061 §2). */
export const setOverrideWorkflow = createWorkflow(
  { name: "cp-tenant-set-override", store: false },
  (input: WorkflowData<SetOverrideInput>) => new WorkflowResponse(setOverrideStep(input))
)

export interface SetFeatureOverrideInput {
  tenant_id: string
  /** A key of the shared platform flag list; the route checks it. */
  key: string
  /** Null removes the exception. */
  override: {
    enabled: boolean
    reason: string
    expires_at: Date | null
    created_by: string | null
  } | null
}

const asFeatureInput = (row: FeatureOverrideRecord | null) =>
  row
    ? {
        enabled: row.enabled,
        reason: row.reason,
        expires_at: row.expires_at,
        created_by: row.created_by,
      }
    : null

const setFeatureOverrideStep = undoableStep(
  "cp-tenant-set-feature-override",
  async (input: SetFeatureOverrideInput, container) => {
    const { before } = await plansIn(container).setFeatureOverride(
      input.tenant_id,
      input.key,
      input.override
    )
    return { output: before, undo: { tenant_id: input.tenant_id, key: input.key, before } }
  },
  async (
    undo: { tenant_id: string; key: string; before: FeatureOverrideRecord | null },
    container
  ) => {
    await plansIn(container).setFeatureOverride(
      undo.tenant_id,
      undo.key,
      asFeatureInput(undo.before)
    )
  }
)

/** A shop's exception for one platform flag set or removed, with its reason (Ek C9). */
export const setFeatureOverrideWorkflow = createWorkflow(
  { name: "cp-tenant-set-feature-override", store: false },
  (input: WorkflowData<SetFeatureOverrideInput>) =>
    new WorkflowResponse(setFeatureOverrideStep(input))
)

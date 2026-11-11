import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { LimitValues } from "../../lib/plans/limits"
import type {
  FeaturePatch,
  PackageFields,
  PackagePatch,
  PackageRecord,
} from "../../modules/plans/types"
import { plansIn } from "../modules"
import { undoableStep } from "../undoable"

export type CreatePackageInput = PackageFields & {
  code: string
  limits: Partial<LimitValues>
  features?: FeaturePatch | undefined
}

const createPackageStep = undoableStep(
  "cp-package-create",
  async (input: CreatePackageInput, container) => {
    const id = await plansIn(container).createPackage(input)
    return { output: { id }, undo: id }
  },
  async (id: string, container) => {
    await plansIn(container).deletePackages([id])
  }
)

/** A new package with every registry limit and its platform flags (adr/0061 §2). */
export const createPackageWorkflow = createWorkflow(
  { name: "cp-package-create", store: false },
  (input: WorkflowData<CreatePackageInput>) => new WorkflowResponse(createPackageStep(input))
)

export interface UpdatePackageInput {
  id: string
  fields: PackagePatch
  limits?: Partial<LimitValues>
  features?: FeaturePatch
}

const updatePackageStep = undoableStep(
  "cp-package-update",
  async (input: UpdatePackageInput, container) => {
    const before = await plansIn(container).updatePackage(
      input.id,
      input.fields,
      input.limits,
      input.features
    )
    // The flags it touched, back to what they were (none: the default)
    const features = Object.fromEntries(
      Object.keys(input.features ?? {}).map((key) => [key, before.features[key] ?? null])
    )
    return { output: before, undo: { before, features } }
  },
  async (undo: { before: PackageRecord; features: FeaturePatch }, container) => {
    const { id, name, price, period, trial_days, grace_days, archived_at, limits } = undo.before
    await plansIn(container).updatePackage(
      id,
      { name, price, period, trial_days, grace_days, archived_at },
      limits,
      undo.features
    )
  }
)

/**
 * A package changed: its name, days, limits, flags, price or period (the
 * route asks a step-up for a price), or archived and back. The package as
 * it was comes back for the audit's from/to. A new price applies from the
 * next period on (adr/0061 §7).
 */
export const updatePackageWorkflow = createWorkflow(
  { name: "cp-package-update", store: false },
  (input: WorkflowData<UpdatePackageInput>) => new WorkflowResponse(updatePackageStep(input))
)

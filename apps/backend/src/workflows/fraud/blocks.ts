import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { FRAUD_GUARD_MODULE } from "../../modules/fraud-guard"
import type FraudGuardModuleService from "../../modules/fraud-guard/service"
import type { BlockInput } from "../../modules/fraud-guard/service"

const guardOf = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)

/**
 * Adds an entry to the shop's block list (F15.6, adr/0044 §4), or renews
 * the one there. Undone by removing a new one, or putting a renewed one back.
 */
const addBlockStep = createStep(
  "fraud-add-block",
  async (input: BlockInput, { container }) => {
    const guard = guardOf(container)
    const [before] = await guard.listFraudBlocks(
      { kind: input.kind, match: input.match },
      { take: 1, select: ["id", "reason", "created_by", "expires_at"] }
    )
    const { id } = await guard.addBlock(input)
    return new StepResponse({ id }, { id, before: before ?? null })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const guard = guardOf(container)
    if (!undo.before) {
      await guard.deleteFraudBlocks(undo.id)
      return
    }
    await guard.updateFraudBlocks({
      id: undo.id,
      reason: undo.before.reason,
      created_by: undo.before.created_by,
      expires_at: undo.before.expires_at,
    })
  }
)

export const addBlockWorkflow = createWorkflow("fraud-add-block", (input: BlockInput) => {
  return new WorkflowResponse(addBlockStep(input))
})

/** Takes an entry off the list (kept as removed); undone by restoring it. */
const removeBlockStep = createStep(
  "fraud-remove-block",
  async (input: { id: string }, { container }) => {
    await guardOf(container).softDeleteFraudBlocks(input.id)
    return new StepResponse(null, input.id)
  },
  async (id, { container }) => {
    if (id) {
      await guardOf(container).restoreFraudBlocks(id)
    }
  }
)

export const removeBlockWorkflow = createWorkflow("fraud-remove-block", (input: { id: string }) => {
  removeBlockStep(input)
  return new WorkflowResponse(null)
})

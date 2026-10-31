import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../lib/errors"
import { FRAUD_GUARD_MODULE } from "../../modules/fraud-guard"
import type FraudGuardModuleService from "../../modules/fraud-guard/service"
import type { Decision } from "../../modules/fraud-guard/service"

/**
 * A person's decision on a held order (F15.6, adr/0044 §3): approved, it
 * ships; turned down, it stays held until cancelled through the usual
 * cancel (with its refund). Only a pending review is decided; one decided
 * meanwhile answers 409. Undone by making it pending again.
 */
const decideStep = createStep(
  "fraud-decide-review",
  async (input: Decision, { container }) => {
    const decided = await container
      .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
      .decide(input)
    if (!decided) {
      throw new ConflictError("fraud.review_decided")
    }
    return new StepResponse(decided, input.id)
  },
  async (reviewId, { container }) => {
    if (!reviewId) {
      return
    }
    await container.resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE).updateFraudReviews({
      id: reviewId,
      status: "pending",
      decided_by: null,
      decided_at: null,
      note: null,
    })
  }
)

export const decideReviewWorkflow = createWorkflow("fraud-decide-review", (input: Decision) => {
  return new WorkflowResponse(decideStep(input))
})

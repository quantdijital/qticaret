import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { FRAUD_GUARD_MODULE } from "../../../modules/fraud-guard"
import type FraudGuardModuleService from "../../../modules/fraud-guard/service"

/**
 * An order waiting for a person's review, or turned down by one, is not
 * shipped (F15.6, adr/0044 §3). Reads only.
 */
export const assertNotHeldStep = createStep(
  "fraud-assert-not-held",
  async (input: { order_id: string }, { container }) => {
    const held = await container
      .resolve<FraudGuardModuleService>(FRAUD_GUARD_MODULE)
      .heldStatus(input.order_id)
    if (held) {
      throw new ValidationError(`fraud.review_${held}`)
    }
    return new StepResponse(null)
  }
)

import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ConflictError } from "../../lib/errors"
import { abandonedCartDetail } from "./abandoned-cart-reads"
import { remindCartStep } from "./cart-reminders"

export interface StaffRemindCartInput {
  cart_id: string
}

/**
 * Whether the cart may be reminded now (İYS: commercial e-mail with
 * consent only), as the panel's button says; a refusal names why. Reads
 * only: nothing to undo.
 */
const checkCartReminderStep = createStep(
  "marketing-check-cart-reminder",
  async (input: StaffRemindCartInput, { container }) => {
    const detail = await abandonedCartDetail(container, input.cart_id)
    if (detail.actions.email_block) {
      throw new ConflictError(`abandoned_carts.${detail.actions.email_block}`)
    }
    return new StepResponse(undefined)
  }
)

/**
 * "E-posta ile hatırlat" (2026-11-06): the cart's one reminder sent now by
 * staff, the same e-mail and link the job sends (adr/0038 §1); deliver()
 * checks consent and suppression again.
 */
export const staffRemindCartWorkflow = createWorkflow(
  "marketing-staff-remind-cart",
  (input: StaffRemindCartInput) => {
    checkCartReminderStep(input)
    return new WorkflowResponse(remindCartStep(input))
  }
)

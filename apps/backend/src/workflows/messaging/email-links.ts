import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { recipientOfToken } from "../../lib/messaging/unsubscribe"
import { BACK_IN_STOCK_MODULE } from "../../modules/back-in-stock"
import type BackInStockModuleService from "../../modules/back-in-stock/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import type { ConsentStatus } from "../../modules/messaging/types"

/**
 * What a message's token link does once its reader confirms (adr/0038 §1,
 * M17; F10.5): from the storefront's page (`/store/...`) or the backend's
 * own (links sent before it). Each workflow is one step, the module's own
 * single transaction: nothing after it can fail and ask for it back. A
 * token that is no token of ours, used or late answers null.
 */

export interface EmailLinkInput {
  token: string
}

const unsubscribeStep = createStep(
  "email-link-unsubscribe",
  async ({ token }: EmailLinkInput, { container }) => {
    // Signed: no one can withdraw someone else's consent
    const hash = recipientOfToken(token)
    if (!hash) {
      return new StepResponse(null)
    }
    // Done once; again changes nothing, and says so the same way
    await container
      .resolve<MessagingModuleService>(MESSAGING_MODULE)
      .revokeByHash("email", hash, "unsubscribe", { via: "link" })
    return new StepResponse({ status: "revoked" as const })
  }
)

/** A commercial e-mail's way out: the recipient's e-mail consent withdrawn. */
export const unsubscribeByLinkWorkflow = createWorkflow(
  "email-link-unsubscribe",
  (input: EmailLinkInput) => new WorkflowResponse(unsubscribeStep(input))
)

const confirmConsentStep = createStep(
  "email-link-confirm-consent",
  async ({ token }: EmailLinkInput, { container }) => {
    const confirmed = await container
      .resolve<MessagingModuleService>(MESSAGING_MODULE)
      .confirmConsentRequest(token)
    return new StepResponse<{ status: ConsentStatus } | null>(
      confirmed ? { status: confirmed.status } : null
    )
  }
)

/** Double opt-in: the consent a request asked for, recorded once within its week. */
export const confirmConsentByLinkWorkflow = createWorkflow(
  "email-link-confirm-consent",
  (input: EmailLinkInput) => new WorkflowResponse(confirmConsentStep(input))
)

const confirmStockAlertStep = createStep(
  "email-link-confirm-stock-alert",
  async ({ token }: EmailLinkInput, { container }) => {
    const confirmed = await container
      .resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
      .confirm(token)
    return new StepResponse(confirmed ? { status: "active" as const } : null)
  }
)

/** A guest's stock alert, turned on from its e-mail within the day. */
export const confirmStockAlertByLinkWorkflow = createWorkflow(
  "email-link-confirm-stock-alert",
  (input: EmailLinkInput) => new WorkflowResponse(confirmStockAlertStep(input))
)

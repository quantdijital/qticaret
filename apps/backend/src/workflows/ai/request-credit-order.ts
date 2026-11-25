import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { requestCreditOrderStep } from "./steps/request-credit-order"
import type { RequestCreditOrderInput } from "./steps/request-credit-order"

/**
 * "Kredi yükle" (adr/0085 K11): a top-up request for one of the packs the
 * platform offers, opened on the control plane. One step, the external
 * call, so nothing after it can fail once the request is open.
 */
export const requestAiCreditOrderWorkflow = createWorkflow(
  "ai-credits-request-order",
  (input: RequestCreditOrderInput) => new WorkflowResponse(requestCreditOrderStep(input))
)

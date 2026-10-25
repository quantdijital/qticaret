import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { setFeatureFlagStep } from "./steps/set-feature-flag"
import type { SetFeatureFlagInput } from "./steps/set-feature-flag"

/** Turns a tenant feature flag on or off (adr/0012). */
export const setFeatureFlagWorkflow = createWorkflow(
  "platform-settings-set-feature",
  (input: SetFeatureFlagInput) => new WorkflowResponse(setFeatureFlagStep(input))
)

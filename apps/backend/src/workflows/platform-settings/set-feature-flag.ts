import {
  WorkflowResponse,
  createHook,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { setFeatureFlagStep } from "./steps/set-feature-flag"
import type { SetFeatureFlagInput } from "./steps/set-feature-flag"

/**
 * Turns a tenant feature flag on or off (adr/0012). The `featureSet` hook
 * lets a feature follow its flag where records must (ADR-0068 §9: the
 * wholesale price lists go off with it); a hook handler that throws
 * undoes the change.
 */
export const setFeatureFlagWorkflow = createWorkflow(
  "platform-settings-set-feature",
  (input: SetFeatureFlagInput) => {
    const change = setFeatureFlagStep(input)
    const featureSet = createHook(
      "featureSet",
      transform({ input, change }, ({ input, change }) => ({
        key: input.key,
        enabled: change.after,
      }))
    )
    return new WorkflowResponse(change, { hooks: [featureSet] })
  }
)

import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { storePlanDocumentStep } from "./steps/store-plan-document"
import type { StorePlanDocumentInput } from "./steps/store-plan-document"
import { syncPlatformFlagsStep } from "./steps/sync-platform-flags"

/**
 * A verified plan document applied (adr/0061 §3.2, §5, Ek C9): stored by
 * the serial rule, then its platform flags given to the flag registry.
 * Either failing undoes both. Its limits are stored and exposed only
 * (enforced in C14); its status's effects come in C15.
 */
export const applyPlanDocumentWorkflow = createWorkflow(
  { name: "control-plane-apply-plan-document", store: false },
  (input: StorePlanDocumentInput) => {
    const stored = storePlanDocumentStep(input)
    const flags = transform({ input, stored }, ({ input: given, stored: result }) => ({
      outcome: result.outcome,
      flags: given.signed.document.platform_flags,
    }))
    const synced = syncPlatformFlagsStep(flags)
    return new WorkflowResponse(
      transform({ stored, synced }, ({ stored: result, synced: sync }) => ({
        outcome: result.outcome,
        ignored: sync.ignored,
      }))
    )
  }
)

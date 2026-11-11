import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { storePlanDocumentStep } from "./steps/store-plan-document"
import type { StorePlanDocumentInput } from "./steps/store-plan-document"
import { syncPlatformFlagsStep } from "./steps/sync-platform-flags"
import type { RefreshScope } from "../../lib/storefront/refresh"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"

/**
 * A verified plan document applied (adr/0061 §3.2, §5, Ek C9): stored by
 * the serial rule, then the stored document's platform flags given to the
 * flag registry, never older ones than it already has (review M1).
 * Either failing undoes both. Its limits are enforced by C14's layer, its
 * status by C15's guard (lib/plan-guard); a new status tells the
 * storefront at once.
 */
export const applyPlanDocumentWorkflow = createWorkflow(
  { name: "control-plane-apply-plan-document", store: false },
  (input: StorePlanDocumentInput) => {
    const stored = storePlanDocumentStep(input)
    // The flags of whatever is stored once this store is done (review M1)
    const flags = transform({ input, stored }, ({ input: given, stored: result }) => ({
      tenant_id: given.signed.document.tenant_id,
      outcome: result.outcome,
    }))
    const synced = syncPlatformFlagsStep(flags)
    // Ek C15: a suspension (or its end) shows on the storefront now, not within its minute
    refreshStorefrontStep(
      transform({ stored }, ({ stored: result }): RefreshScope[] =>
        result.status_changed ? ["site"] : []
      )
    )
    return new WorkflowResponse(
      transform({ stored, synced }, ({ stored: result, synced: sync }) => ({
        outcome: result.outcome,
        ignored: sync.ignored,
      }))
    )
  }
)

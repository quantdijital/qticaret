import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { CUSTOMERS_WHOLESALE } from "../../modules/platform-settings/features"
import { setFeatureFlagWorkflow } from "../platform-settings/set-feature-flag"
import { setWholesaleListsStatus } from "../wholesale/lists-status"

// One handler per hook. ADR-0068 §9: the wholesale flag off, the module's
// price lists become drafts and wholesalers pay retail; on, they apply
// again. Throwing undoes the flag's change.
setFeatureFlagWorkflow.hooks.featureSet(
  async ({ key, enabled }, { container }) => {
    if (key !== CUSTOMERS_WHOLESALE) {
      return new StepResponse(undefined, [])
    }
    const changed = await setWholesaleListsStatus(container, enabled ? "active" : "draft")
    return new StepResponse(undefined, changed)
  },
  async (changed, { container }) => {
    for (const [status, ids] of [
      ["active", changed?.filter((each) => each.before === "active") ?? []],
      ["draft", changed?.filter((each) => each.before === "draft") ?? []],
    ] as const) {
      if (ids.length > 0) {
        await setWholesaleListsStatus(
          container,
          status,
          ids.map((each) => each.id)
        )
      }
    }
  }
)

import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../lib/logging"
import { CUSTOMERS_WHOLESALE } from "../../modules/platform-settings/features"
import { setFeatureFlagWorkflow } from "../platform-settings/set-feature-flag"
import { setWholesaleListsStatus } from "../wholesale/lists-status"
import { queueWholesaleCarts } from "../wholesale/queue"

// One handler per hook. ADR-0068 §9: the wholesale flag off, the module's
// price lists become drafts and wholesalers pay retail; on, they apply
// again. Throwing undoes the flag's change. Their open carts follow in the
// background (security review M2): a cart keeps its unit prices until
// priced again. A job that cannot be queued is logged; the flag stands.
setFeatureFlagWorkflow.hooks.featureSet(
  async ({ key, enabled }, { container }) => {
    if (key !== CUSTOMERS_WHOLESALE) {
      return new StepResponse(undefined, [])
    }
    const changed = await setWholesaleListsStatus(container, enabled ? "active" : "draft")
    if (changed.length > 0) {
      await queueWholesaleCarts(container, null).catch((error: unknown) => {
        logger.warn({ event: "wholesale.carts_not_queued", err: errorSummary(error) })
      })
    }
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

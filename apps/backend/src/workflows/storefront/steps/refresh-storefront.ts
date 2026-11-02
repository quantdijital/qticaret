import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { isRefreshOn, refreshStorefront } from "../../../lib/storefront/refresh"
import type { RefreshScope } from "../../../lib/storefront/refresh"

/**
 * Tells the storefront what changed, last in a workflow (adr/0048 ek
 * 2026-11-03). Fire and forget: the save answers without waiting for the
 * storefront, and nothing here can fail or undo it; the storefront's
 * one-minute cache is the fallback. No scopes: nothing is sent. Off in
 * tests unless one turns it on (`isRefreshOn`).
 */
export const refreshStorefrontStep = createStep(
  "storefront-refresh",
  (scopes: RefreshScope[], { container }) => {
    try {
      if (scopes.length > 0 && isRefreshOn()) {
        void refreshStorefront(container, scopes)
      }
    } catch (error) {
      logger.warn({ event: "storefront.refresh_failed", err: errorSummary(error) })
    }
    return new StepResponse(undefined)
  }
)

/** The step alone, for a subscriber (a layout's publication). */
export const refreshStorefrontWorkflow = createWorkflow(
  "storefront-refresh",
  (scopes: RefreshScope[]) => {
    refreshStorefrontStep(scopes)
    return new WorkflowResponse(undefined)
  }
)

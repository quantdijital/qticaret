import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { scopesForSection } from "../../lib/storefront/refresh"
import { attachMediaStep } from "../media/steps/attach-media"
import { syncFreeShippingWorkflow } from "../promotions/free-shipping"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { refreshStorefrontStep } from "../storefront/steps/refresh-storefront"
import { saveSettingsSectionStep } from "./steps/save-settings-section"
import { shareImageMediaStep } from "./steps/share-image"
import type { SaveSettingsSectionInput } from "./steps/save-settings-section"

const thresholdOf = (values: Record<string, unknown> | null | undefined): number | null => {
  const value = values?.["free_shipping_threshold"]
  return typeof value === "number" && value > 0 ? value : null
}

/**
 * Saves a settings section (F2.3, adr/0012); a later failing step puts the
 * old values back. Pages' SEO answers use the shop's name, templates and
 * host, so cached ones are forgotten. The promotions section's free
 * shipping threshold reaches the shipping options' prices (F4.5). The SEO
 * section's share image must be one of the shop's uploads, and is kept.
 * A section the storefront shows is shown at once (adr/0048 ek 2026-11-03).
 */
export const updatePlatformSettingsWorkflow = createWorkflow(
  "platform-settings-update-section",
  (input: SaveSettingsSectionInput) => {
    const shareImage = shareImageMediaStep(input)
    const saved = saveSettingsSectionStep(input)
    // Kept like a page's cover: the nightly sweep leaves a used upload alone
    attachMediaStep(
      transform({ shareImage }, ({ shareImage }) => ({ link: shareImage, record: [] }))
    )
    forgetResolutionsStep()
    when({ input }, ({ input }) => input.section === "promotions").then(() => {
      // The options follow the new threshold; a later failure puts their prices back
      const threshold = transform({ saved }, ({ saved }) => ({
        threshold: thresholdOf(saved.after as Record<string, unknown>),
      }))
      syncFreeShippingWorkflow.runAsStep({ input: threshold })
    })
    refreshStorefrontStep(transform({ input }, ({ input }) => scopesForSection(input.section)))
    return new WorkflowResponse(saved)
  }
)

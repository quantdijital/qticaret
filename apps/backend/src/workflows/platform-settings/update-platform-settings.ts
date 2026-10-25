import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { forgetResolutionsStep } from "../seo/steps/forget-resolutions"
import { saveSettingsSectionStep } from "./steps/save-settings-section"
import type { SaveSettingsSectionInput } from "./steps/save-settings-section"

/**
 * Saves a settings section (F2.3, adr/0012); a later failing step puts the
 * old values back. Pages' SEO answers use the shop's name, templates and
 * host, so cached ones are forgotten.
 */
export const updatePlatformSettingsWorkflow = createWorkflow(
  "platform-settings-update-section",
  (input: SaveSettingsSectionInput) => {
    const saved = saveSettingsSectionStep(input)
    forgetResolutionsStep()
    return new WorkflowResponse(saved)
  }
)

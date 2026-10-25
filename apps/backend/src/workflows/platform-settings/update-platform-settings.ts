import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { saveSettingsSectionStep } from "./steps/save-settings-section"
import type { SaveSettingsSectionInput } from "./steps/save-settings-section"

/** Saves a settings section (F2.3, adr/0012); a later failing step puts the old values back. */
export const updatePlatformSettingsWorkflow = createWorkflow(
  "platform-settings-update-section",
  (input: SaveSettingsSectionInput) => new WorkflowResponse(saveSettingsSectionStep(input))
)

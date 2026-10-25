import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type { SectionName } from "../../../modules/platform-settings/sections"
import type {
  SectionValues,
  default as PlatformSettingsModuleService,
  StoredSection,
} from "../../../modules/platform-settings/service"

export interface SaveSettingsSectionInput {
  section: SectionName
  values: SectionValues
  actor_id: string | null
}

export const saveSettingsSectionStep = createStep(
  "platform-settings-save-section",
  async (input: SaveSettingsSectionInput, { container }) => {
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const change = await service.saveSection(input.section, input.values, input.actor_id)
    return new StepResponse(
      { before: change.before, after: change.after },
      { section: input.section, previous: change.previous }
    )
  },
  async (
    saved: { section: SectionName; previous: StoredSection | null } | undefined,
    { container }
  ) => {
    if (!saved) {
      return
    }
    const service = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    await service.restoreSection(saved.section, saved.previous)
  }
)

import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { roleSave, rolesAfterPatch } from "../../../lib/storefront/page-roles"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { findRolePages } from "../../storefront/page-roles"
import type { SaveSettingsSectionInput } from "./save-settings-section"

/**
 * A storefront section's save with its page roles by id (adr/0073 Açık
 * kararlar 3): a page sent must be one of the shop's content pages (not a
 * post); a role still named by an old path is written by its page's id
 * once that page is found. Other sections pass as they are. Reads only.
 */
export const pageRolesStep = createStep(
  "platform-settings-page-roles",
  async (input: SaveSettingsSectionInput, { container }) => {
    if (input.section !== "storefront") {
      return new StepResponse(input)
    }
    const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const before = (await settings.readSection("storefront")).values
    const patch = input.values
    const pages = await findRolePages(container, rolesAfterPatch(before, patch))
    const { fields, unknown } = roleSave(before, patch, pages)
    const [field] = unknown
    if (field !== undefined) {
      throw new ValidationError("platform_settings.page_unknown", { field })
    }
    return new StepResponse({ ...input, values: { ...patch, ...fields } })
  }
)

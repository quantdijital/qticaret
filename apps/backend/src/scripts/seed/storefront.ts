import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { updatePlatformSettingsWorkflow } from "../../workflows/platform-settings/update-platform-settings"
import { DEMO_STOREFRONT } from "./data"

/**
 * Fills the storefront's frame once; a frame the shop (or an earlier seed)
 * already saved is left as it is.
 */
export async function ensureDemoStorefront(container: MedusaContainer): Promise<void> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const { version } = await settings.readSection("storefront")
  if (version > 0) {
    return
  }
  await updatePlatformSettingsWorkflow(container).run({
    input: { section: "storefront", values: DEMO_STOREFRONT, actor_id: null },
  })
}

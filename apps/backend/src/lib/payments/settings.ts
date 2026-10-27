import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PaymentSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/** The shop's payment choices (F5 V6, V10), for every card provider. */
export async function paymentSettings(
  container: Pick<MedusaContainer, "resolve">
): Promise<PaymentSettings> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  return (await settings.getSection("payments")) as unknown as PaymentSettings
}

import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { PaymentLinkSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/** The owner's choices for payment links (adr/0051): an admin's discount limit, cash on delivery. */
export async function paymentLinkSettings(
  container: Pick<MedusaContainer, "resolve">
): Promise<PaymentLinkSettings> {
  return (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("payment_links")) as unknown as PaymentLinkSettings
}

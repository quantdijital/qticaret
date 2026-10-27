import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type {
  BankTransferSettings,
  CashOnDeliverySettings,
  PaymentSettings,
} from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/** The shop's payment choices (F5 V6, V10), for every card provider. */
export async function paymentSettings(
  container: Pick<MedusaContainer, "resolve">
): Promise<PaymentSettings> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  return (await settings.getSection("payments")) as unknown as PaymentSettings
}

/** The shop's bank account for transfers (F6, adr/0029). */
export async function bankTransferSettings(
  container: Pick<MedusaContainer, "resolve">
): Promise<BankTransferSettings> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  return (await settings.getSection("bank_transfer")) as unknown as BankTransferSettings
}

/** Cash on delivery's fee, limit and couriers (F6, adr/0029). */
export async function cashOnDeliverySettings(
  container: Pick<MedusaContainer, "resolve">
): Promise<CashOnDeliverySettings> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  return (await settings.getSection("cash_on_delivery")) as unknown as CashOnDeliverySettings
}

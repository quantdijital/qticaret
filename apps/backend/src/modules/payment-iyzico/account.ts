import { container } from "@medusajs/framework"
import { iyzicoCredentialsOf } from "../../lib/payments/iyzico"
import type { IyzicoCredentials } from "../../lib/payments/iyzico"
import { INTEGRATION_CREDENTIALS_MODULE } from "../integration-credentials"
import type IntegrationCredentialsModuleService from "../integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../platform-settings"
import type { PaymentSettings } from "../platform-settings/sections"
import type PlatformSettingsModuleService from "../platform-settings/service"

/**
 * The shop's iyzico account at the time of the call (adr/0027), from the
 * app's shared container, as the PayTR provider reads its own. Null when
 * nothing is stored or it cannot be opened.
 */
export async function storedIyzicoAccount(): Promise<IyzicoCredentials | null> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  return iyzicoCredentialsOf(await credentials.read("iyzico"))
}

/** The shop's installment choices (F5 V6): one setting for every card provider. */
export async function storedPaymentSettings(): Promise<PaymentSettings> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  return (await settings.getSection("payments")) as unknown as PaymentSettings
}

import { container } from "@medusajs/framework"
import { paytrCredentialsOf } from "../../lib/payments/paytr"
import type { PaytrCredentials } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../integration-credentials"
import type IntegrationCredentialsModuleService from "../integration-credentials/service"
import { PLATFORM_SETTINGS_MODULE } from "../platform-settings"
import type { PaymentSettings } from "../platform-settings/sections"
import type PlatformSettingsModuleService from "../platform-settings/service"

/**
 * The shop's PayTR account at the time of the call (adr/0027). A provider
 * sees only its module's container; the account comes from the app's
 * shared one, resolved per call: providers are built before the modules
 * are registered there. Null when nothing is stored or it cannot be opened.
 */
export async function storedPaytrAccount(): Promise<PaytrCredentials | null> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  return paytrCredentialsOf(await credentials.read("paytr"))
}

/** The shop's installment choices (F5 V6), read at the time of the call like the account. */
export async function storedPaymentSettings(): Promise<PaymentSettings> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  return (await settings.getSection("payments")) as unknown as PaymentSettings
}

import type { MedusaContainer } from "@medusajs/framework/types"
import { accountingAdapterOf } from "../../lib/accounting"
import type { AccountingAdapter, AccountingAdapterId } from "../../lib/accounting"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { AccountingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

/** The shop's accounting program as set, and its adapter; null adapter: nothing is sent. */
export async function activeAccountingAdapter(container: MedusaContainer): Promise<{
  id: AccountingAdapterId
  adapter: AccountingAdapter | null
}> {
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("accounting")) as unknown as AccountingSettings
  return { id: settings.adapter, adapter: accountingAdapterOf(settings.adapter) }
}

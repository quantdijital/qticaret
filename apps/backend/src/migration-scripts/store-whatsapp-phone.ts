import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { PLATFORM_SETTINGS_MODULE } from "../modules/platform-settings"
import type { StoreSettings } from "../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../modules/platform-settings/service"

type Settings = Pick<
  PlatformSettingsModuleService,
  "listSettingsSections" | "readSection" | "saveSection"
>
type Audit = Pick<AuditLogModuleService, "record">

/**
 * The WhatsApp number moves from the storefront section to the store
 * details (adr/0048): the stored storefront values still hold it (a field
 * the schema no longer knows is only dropped on read), so it is copied
 * over unless the store details already have one. Returns whether it moved.
 */
export async function moveWhatsappPhone(settings: Settings, audit: Audit): Promise<boolean> {
  const [row] = await settings.listSettingsSections({ section: "storefront" }, { take: 1 })
  // A shop that never saved its storefront has no row
  const saved = (row as { values?: Record<string, unknown> } | undefined)?.values
  const stored = saved?.["whatsapp_phone"]
  if (typeof stored !== "string" || stored === "") {
    return false
  }
  const { values } = await settings.readSection("store")
  if ((values as unknown as StoreSettings).whatsapp_phone) {
    return false
  }
  await settings.saveSection("store", { whatsapp_phone: stored }, null)
  await audit.record({
    kind: "system",
    action: "store.whatsapp_phone_moved",
    actor_type: "system",
    resource_type: "platform_settings",
    resource_id: "store",
    changes: { whatsapp_phone: { before: null, after: stored } },
  })
  return true
}

/** Runs once per shop, on the `db:migrate` that brings the store profile (adr/0048). */
export default async function storeWhatsappPhone({ container }: ExecArgs) {
  const moved = await moveWhatsappPhone(
    container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE),
    container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  )
  logger.info({ event: "store.whatsapp_phone_checked", moved })
}

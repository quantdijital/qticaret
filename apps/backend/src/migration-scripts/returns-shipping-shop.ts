import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { PLATFORM_SETTINGS_MODULE } from "../modules/platform-settings"
import type PlatformSettingsModuleService from "../modules/platform-settings/service"

type Settings = Pick<PlatformSettingsModuleService, "listSettingsSections" | "saveSection">
type Audit = Pick<AuditLogModuleService, "record">

/**
 * "Who pays the return shipping: the customer" is gone (adr/0032 Ek
 * 2026-11-03; MSY md. 12/5 as in force since 1.1.2026): a shop that chose
 * it is moved to the shop paying, as the system, recorded in the audit
 * log. A stored "customer" would otherwise fall back to the default on
 * every read, logged as an invalid section. Returns whether it moved.
 */
export async function moveReturnShippingToShop(settings: Settings, audit: Audit): Promise<boolean> {
  const [row] = await settings.listSettingsSections({ section: "returns" }, { take: 1 })
  // A shop that never saved its return policy has no row
  const saved = (row as { values?: Record<string, unknown> } | undefined)?.values
  if (saved?.["return_shipping"] !== "customer") {
    return false
  }
  await settings.saveSection("returns", { return_shipping: "shop" }, null)
  await audit.record({
    kind: "system",
    action: "returns.return_shipping_moved",
    actor_type: "system",
    resource_type: "platform_settings",
    resource_id: "returns",
    changes: { return_shipping: { before: "customer", after: "shop" } },
  })
  return true
}

/** Runs once per shop, on the `db:migrate` that drops the option (adr/0032 Ek 2026-11-03). */
export default async function returnsShippingShop({ container }: ExecArgs) {
  const moved = await moveReturnShippingToShop(
    container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE),
    container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  )
  logger.info({ event: "returns.return_shipping_checked", moved })
}

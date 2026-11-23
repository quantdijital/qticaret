import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { PLATFORM_SETTINGS_MODULE } from "../modules/platform-settings"
import type { SeoSettings } from "../modules/platform-settings/sections"
import { DEFAULT_ROBOTS_TXT } from "../modules/platform-settings/sections/seo"
import type PlatformSettingsModuleService from "../modules/platform-settings/service"

// The default before F3.17, as the code had it: English parameters the storefront never writes
export const PREVIOUS_DEFAULT = [
  "User-agent: *",
  "Disallow: /sepet",
  "Disallow: /odeme",
  "Disallow: /hesap",
  "Disallow: /arama",
  "Disallow: /*?sort=",
  "Disallow: /*?page=0",
  "",
  "Sitemap: {sitemap_url}",
].join("\n")

type Settings = Pick<PlatformSettingsModuleService, "readSection" | "saveSection">
type Audit = Pick<AuditLogModuleService, "record">

/**
 * The old default robots template a shop saved becomes the new one, and
 * the change is in the audit log as the system's. A template the shop
 * wrote stays; so does a shop that never saved (it reads the default).
 * Returns whether it changed.
 */
export async function updateRobotsDefault(
  settings: Settings,
  audit: Audit,
  previous: string = PREVIOUS_DEFAULT
): Promise<boolean> {
  const { values, version } = await settings.readSection("seo")
  const template = (values as unknown as SeoSettings).robots_txt.replace(/\r\n?/g, "\n").trim()
  if (version === 0 || template !== previous) {
    return false
  }
  await settings.saveSection("seo", { robots_txt: DEFAULT_ROBOTS_TXT }, null)
  await audit.record({
    kind: "system",
    action: "seo.robots_default_updated",
    actor_type: "system",
    resource_type: "platform_settings",
    resource_id: "seo",
    changes: { robots_txt: { before: previous, after: DEFAULT_ROBOTS_TXT } },
  })
  return true
}

/**
 * Runs once per shop, on the `db:migrate` that brings the listing filters
 * (F3.17, docs/13 §7). A template of the shop's own is left to the store
 * audit, which says so if it leaves filtered listings open (S-ROBOTS-01).
 */
export default async function seoRobotsFacetLines({ container }: ExecArgs) {
  const updated = await updateRobotsDefault(
    container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE),
    container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  )
  logger.info({ event: "seo.robots_default_checked", updated })
}

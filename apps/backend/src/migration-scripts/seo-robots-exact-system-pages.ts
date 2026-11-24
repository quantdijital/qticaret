import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { PLATFORM_SETTINGS_MODULE } from "../modules/platform-settings"
import type PlatformSettingsModuleService from "../modules/platform-settings/service"
import { updateRobotsDefault } from "./seo-robots-facet-lines"

// The default from F3.17 until 2026-11-23, as the code had it: bare prefixes that
// also closed a shop's root categories starting so (`/hesap-makineleri`)
export const F3_17_DEFAULT = [
  "User-agent: *",
  "Disallow: /sepet",
  "Disallow: /odeme",
  "Disallow: /hesap",
  "Disallow: /arama",
  "{facet_disallow}",
  "",
  "Sitemap: {sitemap_url}",
].join("\n")

/**
 * Runs once per shop: the default robots template a shop saved becomes
 * the one that closes each system page exactly (adr/0017 Ek 2026-11-23),
 * recorded in the audit log as the system's. A template of the shop's own
 * stays; a shop that never saved reads the new default already.
 */
export default async function seoRobotsExactSystemPages({ container }: ExecArgs) {
  const updated = await updateRobotsDefault(
    container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE),
    container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE),
    F3_17_DEFAULT
  )
  logger.info({ event: "seo.robots_default_checked", updated, step: "exact_system_pages" })
}

import { PLATFORM_SETTINGS_MODULE } from "../../../../modules/platform-settings"
import { featureDefinition } from "../../../../modules/platform-settings/features"
import { isSectionName } from "../../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../../modules/platform-settings/service"
import type { AuditedResource, Resolver, Snapshot } from "../types"

/**
 * Platform settings and feature flags (adr/0011, adr/0012): every field of
 * a section before and after, nested ones by their path
 * (`title_templates.product`), and a flag's effective value, both read
 * from the database, not the cache.
 */

const service = (scope: Resolver) =>
  scope.resolve(PLATFORM_SETTINGS_MODULE) as PlatformSettingsModuleService

function flatten(values: Record<string, unknown>): Snapshot {
  const flat: Snapshot = {}
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        flat[`${key}.${inner}`] = innerValue
      }
    } else {
      flat[key] = value
    }
  }
  return flat
}

export const SETTINGS_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/platform-settings/:section",
    pattern: /^\/admin\/platform-settings\/(?<section>[a-z_]+)$/i,
    resourceType: "platform_settings",
    resourceId: (params) => params["section"] ?? null,
    // A sole trader's contact details are a person's
    sensitive: ["contact_email", "contact_phone"],
    snapshot: async ({ scope, params }) => {
      const section = params["section"] ?? ""
      return isSectionName(section)
        ? flatten((await service(scope).readSection(section)).values)
        : {}
    },
  },
  {
    method: "POST",
    route: "POST /admin/features/:key",
    pattern: /^\/admin\/features\/(?<key>[a-z0-9_.]+)$/i,
    resourceType: "feature",
    resourceId: (params) => params["key"] ?? null,
    snapshot: async ({ scope, params }) => {
      const key = params["key"] ?? ""
      return featureDefinition(key) ? { enabled: await service(scope).readFeature(key) } : {}
    },
  },
]

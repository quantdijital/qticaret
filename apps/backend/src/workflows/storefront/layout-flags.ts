import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { typesOff } from "../../lib/storefront/sections/requires"
import type { SectionRequires } from "../../lib/storefront/sections/requires"

/**
 * The section types whose feature flag is off in this shop now (adr/0077
 * §8), each with its flag: the design given to the storefront leaves them
 * out, a ready-made look drops them. No flag read while no section needs one.
 */
export function sectionTypesOff(
  container: MedusaContainer,
  requires?: SectionRequires
): Promise<Map<string, string>> {
  // Resolved only when a flag is read
  const isEnabled = (flag: string) =>
    container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .isFeatureEnabled(flag)
  return typesOff(isEnabled, requires)
}

/** The types off, as a cache key's part: the same flags, the same design. */
export const offKey = (off: ReadonlyMap<string, string>): string => [...off.keys()].sort().join(",")

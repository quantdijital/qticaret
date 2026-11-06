import type { MedusaContainer } from "@medusajs/framework/types"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { shownSettings, storedSettings, withLegacy } from "../../lib/storefront/layout-settings"
import type { ShownSettings } from "../../lib/storefront/layout-settings"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { StorefrontSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { layoutRow } from "./layout"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The theme's shared settings (adr/0049 Ek 2026-11-06) where they are not
 * yet written in the design: the storefront settings' old fields, read
 * and never written again.
 */
export const legacySettings = async (container: Container): Promise<StorefrontSettings> =>
  (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("storefront")) as unknown as StorefrontSettings

/**
 * The document with each unset shared part filled from the old fields: the
 * editor opens what the storefront shows, and its first save carries the
 * values into the draft. Settings the schema no longer reads count as unset.
 */
export function withLegacySettings(
  doc: LayoutDocument,
  legacy: StorefrontSettings
): LayoutDocument {
  return { ...doc, settings: withLegacy(storedSettings(doc), legacy) }
}

/**
 * The shared settings live now (the published design's, else the old
 * fields): the cards' "Az kaldı" and `GET /store/storefront`'s own copy of
 * the badges and swatches. A draft is never read here.
 */
export async function liveSettings(container: Container): Promise<ShownSettings> {
  const [row, legacy] = await Promise.all([layoutRow(container), legacySettings(container)])
  return shownSettings(storedSettings(row?.published ?? null), legacy)
}

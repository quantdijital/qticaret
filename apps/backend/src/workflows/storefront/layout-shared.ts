import type { MedusaContainer } from "@medusajs/framework/types"
import type { LayoutDocument } from "../../lib/storefront/layout"
import { withMainSections } from "../../lib/storefront/layout-main"
import { shownSettings, storedSettings, withLegacy } from "../../lib/storefront/layout-settings"
import type { Legacy, ShownSettings } from "../../lib/storefront/layout-settings"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { StorefrontSettings, ThemeSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { layoutRow } from "./layout-row"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The theme's shared settings (adr/0049 Ek 2026-11-06) where they are not
 * yet written in the design: the storefront settings' old fields, read
 * and never written again; and the theme section with them (adr/0063 §3),
 * which the panel no longer writes.
 */
export async function legacySettings(container: Container): Promise<StorefrontSettings & Legacy> {
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [storefront, theme] = await Promise.all([
    settings.getSection("storefront"),
    settings.getSection("theme"),
  ])
  return {
    ...(storefront as unknown as StorefrontSettings),
    theme: theme as unknown as ThemeSettings,
  }
}

/**
 * The document with each unset shared part filled from the old fields: the
 * editor opens what the storefront shows, and its first save carries the
 * values into the draft. Settings the schema no longer reads count as unset.
 * So do the main sections it lacks (adr/0049 Ek 2026-11-14 §5, §7), the
 * header bar from the theme's header as the document (else the theme
 * section) holds it.
 */
export function withLegacySettings(doc: LayoutDocument, legacy: Legacy): LayoutDocument {
  const settings = withLegacy(storedSettings(doc), legacy)
  const header = (settings.theme ?? legacy.theme).header
  return withMainSections({ ...doc, settings }, header)
}

/**
 * The shared settings live now (the published design's, else the old
 * fields): the cards' "Az kaldı", `GET /store/storefront`'s own copy of
 * the badges and swatches and its theme (adr/0063 §3). A draft is never
 * read here.
 */
export async function liveSettings(container: Container): Promise<ShownSettings> {
  const [row, legacy] = await Promise.all([layoutRow(container), legacySettings(container)])
  return shownSettings(storedSettings(row?.published ?? null), legacy)
}

import type { MedusaContainer } from "@medusajs/framework/types"
import { fillShopText } from "../../lib/shop/tokens"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { MaintenanceSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { shopInfoValues } from "../shop/info-values"

type Container = Pick<MedusaContainer, "resolve">

/** What the storefront's edge needs to go dark (adr/0053), in `GET /store/seo/site`. */
export interface SiteMaintenance {
  enabled: boolean
  /** null: the storefront's own heading. */
  title: string | null
  /** The shop's `{belirteç}`s filled in. */
  message: string | null
  /** ISO 8601; the storefront's `Retry-After` while it is ahead. */
  expected_at: string | null
  /** Open while dark besides the storefront's system paths: exact, or `/x/*` for below. */
  allow_paths: string[]
}

/** Nothing of a prepared message shows while the shop is open. */
export const MAINTENANCE_OFF: SiteMaintenance = {
  enabled: false,
  title: null,
  message: null,
  expected_at: null,
  allow_paths: [],
}

const settingsOf = (container: Container) =>
  container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

/** The maintenance answer for the storefront, from the cached settings. */
export async function siteMaintenance(container: Container): Promise<SiteMaintenance> {
  const values = (await settingsOf(container).getSection(
    "maintenance"
  )) as unknown as MaintenanceSettings
  if (!values.enabled) {
    return MAINTENANCE_OFF
  }
  const filled =
    values.message === null ? null : fillShopText(values.message, await shopInfoValues(container))
  return {
    enabled: true,
    title: values.title,
    // A line made only of details the shop has not given says nothing
    message: filled === null || filled.trim() === "" ? null : filled,
    expected_at: values.expected_at,
    allow_paths: values.allow_paths,
  }
}

/** The section as stored now, past the cache: a bypass link is bound to its version. */
export async function maintenanceState(
  container: Container
): Promise<{ enabled: boolean; version: number }> {
  const { values, version } = await settingsOf(container).readSection("maintenance")
  return { enabled: (values as unknown as MaintenanceSettings).enabled, version }
}

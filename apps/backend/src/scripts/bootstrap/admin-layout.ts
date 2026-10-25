import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logger } from "../../lib/logging"

/**
 * The admin menus every shop starts with (adr/0021, docs/17), written as the
 * dashboard's system default layout (core settings module, 2.17.2+):
 * - main menu: Home first, under the search bar;
 * - settings menu: our pages in "General", developer items (API keys,
 *   workflows, search) hidden from shop owners.
 *
 * Hiding only takes an item out of the menu; its page still opens by URL
 * and the API decides who may do what. A zone that already has a system
 * default keeps it: the shop's or the platform team's choice wins.
 */

interface WidgetPlacement {
  order?: number
  hidden?: boolean
  section?: string
}

interface LayoutSettings {
  getSystemDefaultLayoutConfiguration(zone: string): Promise<unknown>
  setSystemDefaultLayoutConfiguration(
    zone: string,
    data: { widgets: Record<string, WidgetPlacement> }
  ): Promise<unknown>
}

// Items without a placement keep order 0 and their source order, so the
// two lifted to the top take negative orders
const MAIN_MENU: Record<string, WidgetPlacement> = {
  "core:Searchbar": { order: -2 },
  "core:nav:/home": { order: -1 },
}

const settingsItem = (path: string) => `core:settings-nav:/settings/${path}`

const SETTINGS_MENU: Record<string, WidgetPlacement> = {
  ...Object.fromEntries(
    ["publishable-api-keys", "secret-api-keys", "workflows", "search"].map((path) => [
      settingsItem(path),
      { hidden: true },
    ])
  ),
  ...Object.fromEntries(
    ["seo", "features", "attribute-templates", "async-jobs"].map((path) => [
      settingsItem(path),
      { section: "general" },
    ])
  ),
}

export const ADMIN_LAYOUTS: Readonly<Record<string, Record<string, WidgetPlacement>>> = {
  sidebar: MAIN_MENU,
  "settings.sidebar": SETTINGS_MENU,
}

export async function ensureAdminLayouts(container: MedusaContainer): Promise<void> {
  const settings = container.resolve<LayoutSettings>(Modules.SETTINGS)
  for (const [zone, widgets] of Object.entries(ADMIN_LAYOUTS)) {
    if (await settings.getSystemDefaultLayoutConfiguration(zone)) {
      logger.info({ event: "bootstrap.admin_layout_kept", zone }, "admin layout exists, keeping it")
      continue
    }
    await settings.setSystemDefaultLayoutConfiguration(zone, { widgets })
    logger.info({ event: "bootstrap.admin_layout_set", zone }, "admin layout set")
  }
}

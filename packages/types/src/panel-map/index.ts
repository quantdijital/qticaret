import { ACTION_ENTRIES } from "./actions.js"
import { MENU_ENTRIES } from "./menu.js"
import { PAGE_ENTRIES } from "./pages.js"
import { SEO_ENTRIES } from "./seo.js"
import { SETTINGS_MESSAGES_ENTRIES } from "./settings-messages.js"
import { SETTINGS_SELLING_ENTRIES } from "./settings-selling.js"
import { SETTINGS_SHOP_ENTRIES } from "./settings-shop.js"
import { SETTINGS_SYSTEM_ENTRIES } from "./settings-system.js"
import type { PanelMapEntry } from "./types.js"

export type { PanelMapEntry, PanelMapText } from "./types.js"

/**
 * The panel's map (adr/0079 §4), in the order a tie is shown: the menu's
 * items first, then the pages under them, the common jobs, the settings.
 */
export const PANEL_MAP: readonly PanelMapEntry[] = [
  ...MENU_ENTRIES,
  ...PAGE_ENTRIES,
  ...ACTION_ENTRIES,
  ...SETTINGS_SHOP_ENTRIES,
  ...SEO_ENTRIES,
  ...SETTINGS_SELLING_ENTRIES,
  ...SETTINGS_MESSAGES_ENTRIES,
  ...SETTINGS_SYSTEM_ENTRIES,
]

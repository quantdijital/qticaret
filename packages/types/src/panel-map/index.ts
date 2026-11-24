import { ACTION_ENTRIES } from "./actions"
import { MENU_ENTRIES } from "./menu"
import { PAGE_ENTRIES } from "./pages"
import { SEO_ENTRIES } from "./seo"
import { SETTINGS_MESSAGES_ENTRIES } from "./settings-messages"
import { SETTINGS_SELLING_ENTRIES } from "./settings-selling"
import { SETTINGS_SHOP_ENTRIES } from "./settings-shop"
import { SETTINGS_SYSTEM_ENTRIES } from "./settings-system"
import type { PanelMapEntry } from "./types"

export type { PanelMapEntry, PanelMapText } from "./types"
export {
  SEARCH_LIMIT,
  WEIGHTS,
  firstSentence,
  foldText,
  searchPanelMap,
  trailIn,
  wordsOf,
} from "./search"
export type { PanelSearchHit, PanelSearchOptions } from "./search"
export { PANEL_RECORDS, PANEL_RECORD_ID, PANEL_RECORD_TYPES } from "./records"
export type { PanelRecordRoute, PanelRecordType } from "./records"

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

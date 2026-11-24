import { PANEL_MAP, searchPanelMap } from "@qticaret/types/panel-map"
import type { PanelMapEntry } from "@qticaret/types/panel-map"
import { capabilitiesOf } from "../../staff/permissions"
import type { StaffRole } from "../../staff/permissions"

/**
 * The panel's screens as the assistant sees them (adr/0079 §4): the
 * panel's own map (`@qticaret/types/panel-map`), searched on the server
 * with the very search of the panel's command menu, never by the model,
 * and narrowed to what the person's role and the shop's flags show.
 */

export type PanelScreen = PanelMapEntry

/** The map the assistant searches: the panel's, one list for both. */
export const PANEL_SCREENS: readonly PanelScreen[] = PANEL_MAP

export const MAX_SCREEN_RESULTS = 5

/** The tenant flags the map names: read once a turn to narrow it. */
export const screenFeatures = (screens: readonly PanelScreen[] = PANEL_SCREENS): string[] => [
  ...new Set(screens.flatMap((screen) => (screen.feature === undefined ? [] : [screen.feature]))),
]

/**
 * The screens this role sees with these flags on: its capability and
 * its flag, and its parent's, all hold. An unknown capability or parent
 * hides the screen (closed by default).
 */
export function visibleScreens(
  role: StaffRole,
  enabledFeatures: ReadonlySet<string>,
  screens: readonly PanelScreen[] = PANEL_SCREENS
): PanelScreen[] {
  const can = capabilitiesOf(role) as Readonly<Record<string, boolean>>
  const byKey = new Map(screens.map((screen) => [screen.key, screen]))
  const shown = (screen: PanelScreen, depth: number): boolean => {
    if (depth > 8) {
      return false
    }
    if (screen.needs !== undefined && can[screen.needs] !== true) {
      return false
    }
    if (screen.feature !== undefined && !enabledFeatures.has(screen.feature)) {
      return false
    }
    if (screen.parent === undefined) {
      return true
    }
    const parent = byKey.get(screen.parent)
    return parent !== undefined && shown(parent, depth + 1)
  }
  return screens.filter((screen) => shown(screen, 0))
}

/*
 * The server holds no panel text: a name's key stands for its words
 * ("settings.shipping.tabs.options" reads "settings shipping tabs
 * options"), the keywords and the help in both languages carry the rest.
 */
const keyWords = (key: string): string => key.replace(/[._]/g, " ")

/**
 * The best fitting screens among these (already the person's own), at
 * most five, ties in the map's order. The panel's search first, every
 * word needed; a model's sentence that so finds none is read loosely
 * (some words, a suffix allowed).
 */
export function searchScreens(
  query: string,
  screens: readonly PanelScreen[],
  language: "tr" | "en" = "tr"
): PanelScreen[] {
  const options = {
    text: keyWords,
    language,
    allowed: () => true,
    limit: MAX_SCREEN_RESULTS,
  }
  const strict = searchPanelMap(query, screens, options)
  const hits =
    strict.length > 0 ? strict : searchPanelMap(query, screens, { ...options, loose: true })
  return hits.map((hit) => hit.screen)
}

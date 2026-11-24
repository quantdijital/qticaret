import { capabilitiesOf } from "../../staff/permissions"
import type { StaffRole } from "../../staff/permissions"
import { INTERIM_SCREENS } from "./screen-list"

/**
 * The panel's screens as the assistant sees them (adr/0079 §4): the
 * shape of the panel map's entry (`packages/types/src/panel-map`
 * `PanelMapEntry`), searched on the server by word, never by the model,
 * and narrowed to what the person's role and the shop's flags show.
 */

export interface PanelScreen {
  /** Unique; the panel builds the link from it, never from a model's text. */
  readonly key: string
  /** The entry it sits under (`settings.shipping`); its gates hold for this one too. */
  readonly parent?: string
  /** Shown only while this tenant flag is on (adr/0012). */
  readonly feature?: string
  /** Shown only to a role with this capability (`capabilitiesOf`, adr/0040). */
  readonly needs?: string
  /** Its name: an i18n key of the panel. */
  readonly label: string
  readonly keywords: { readonly tr: readonly string[]; readonly en: readonly string[] }
  /** What is done there, at most three sentences. */
  readonly help: { readonly tr: string; readonly en: string }
}

/** The map the assistant searches; the panel map's `PANEL_MAP` once it is in `dev`. */
export const PANEL_SCREENS: readonly PanelScreen[] = INTERIM_SCREENS

export const MAX_SCREEN_RESULTS = 5
const MAX_QUERY_CHARS = 200
const MAX_QUERY_WORDS = 20

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

const FOLD: Readonly<Record<string, string>> = {
  ı: "i",
  ş: "s",
  ğ: "g",
  ü: "u",
  ö: "o",
  ç: "c",
  â: "a",
  î: "i",
  û: "u",
}

/** Lower case, Turkish letters folded, anything but letters and digits a space. */
export function wordsOf(text: string): string[] {
  return text
    .slice(0, MAX_QUERY_CHARS)
    .toLocaleLowerCase("tr")
    .replace(/[ışğüöçâîû]/g, (letter) => FOLD[letter] ?? letter)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word !== "")
    .slice(0, MAX_QUERY_WORDS)
}

// A word of the query takes a keyword's word with a suffix ("ücretini" for "ücret")
const takes = (queryWord: string, keywordWord: string): boolean =>
  queryWord === keywordWord || (keywordWord.length >= 3 && queryWord.startsWith(keywordWord))

/**
 * How well a screen's keywords fit the query: a keyword whose every word
 * is in the query counts three a word (longer phrases are surer), a
 * keyword met in part one a word met.
 */
function scoreOf(screen: PanelScreen, query: readonly string[]): number {
  let score = 0
  for (const keyword of [...screen.keywords.tr, ...screen.keywords.en]) {
    const words = wordsOf(keyword)
    const met = words.filter((word) => query.some((each) => takes(each, word))).length
    if (met === 0) {
      continue
    }
    score += met === words.length ? 3 * words.length : met
  }
  return score
}

/** The best fitting screens for the query, at most five, ties in the map's order. */
export function searchScreens(query: string, screens: readonly PanelScreen[]): PanelScreen[] {
  const words = wordsOf(query)
  if (words.length === 0) {
    return []
  }
  return screens
    .map((screen, index) => ({ screen, index, score: scoreOf(screen, words) }))
    .filter((each) => each.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_SCREEN_RESULTS)
    .map((each) => each.screen)
}

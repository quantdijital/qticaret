/**
 * Finding a screen by the everyday words people type (adr/0079 Y1-0). The
 * search lives beside the map (`@qticaret/types/panel-map`): the backend's
 * assistant (`find_screen`) runs the same one.
 */
export {
  SEARCH_LIMIT,
  WEIGHTS,
  firstSentence,
  foldText,
  searchPanelMap,
  trailIn,
  wordsOf,
} from "@qticaret/types/panel-map"
export type { PanelSearchHit, PanelSearchOptions } from "@qticaret/types/panel-map"

import type { DeparturesSettings } from "@qticaret/types"
import type { ImageView, PriceView } from "./views"
import type { HeadLinesView } from "./hand-note-views"

/**
 * Upcoming departures as a theme draws them (`departures`, adr/0077 §10):
 * a heading, an optional intro, then the nearest departures on sale by
 * date. `list`: one row each, a date box (day large, month and weekday
 * small), the tour's name, the places left when few, the price and an
 * "İncele" link; `cards`: the same as a card with the tour's photograph.
 * The storefront worded and formatted everything (the date in the
 * product's zone, the price as a "from" price); it leaves out a section
 * with no departure, and a theme without this type draws nothing.
 */
export interface DeparturesSectionView extends DeparturesSettings, HeadLinesView {
  id: string
  type: "departures"
  /** The shop's heading, else the storefront's own words. */
  title: string
  intro: string | null
  rows: DepartureRowView[]
  /** The link's words ("İncele"). */
  open: string
}

export interface DepartureRowView {
  /** The departure's id: a stable key. */
  key: string
  /** The product page. */
  path: string
  title: string
  /** The tour's photograph (the cards layout); null: none. */
  image: ImageView | null
  date: DepartureDateView
  /** "Son 3 yer", only when few are left; else null. */
  left: string | null
  /** The lowest paying place on it as a "from" price; null: none to say. */
  price: PriceView | null
}

export interface DepartureDateView {
  /** ISO time, for `<time dateTime>`. */
  iso: string
  /** "12" */
  day: string
  /** "Ara" */
  month: string
  /** "Cmt" */
  weekday: string
  /** "12 Aralık 2026 Cumartesi 09:00", the whole date for a screen reader and the cards. */
  full: string
}

import type { SectionIcon, StatsSettings, StepsSettings } from "@qticaret/types"
import type { HandNoteView } from "./hand-note-views"
import type { LinkView } from "./views"

/**
 * The figures strip as a theme draws it (`stats`, adr/0077 §10): two to
 * six figures in the shop's order, each its value set large, its label and
 * an optional line, the shop's details filled. Its ground and alignment
 * are the section's look. A theme draws them as a list (`dl`), never
 * counting or animating the values; the storefront leaves out a strip
 * with no figure.
 */
export interface StatsSectionView extends StatsSettings {
  id: string
  type: "stats"
  /** The section's heading (an h2); null: none, the list named for a screen reader (`label`). */
  title: string | null
  /** The list's name for a screen reader while there is no heading. */
  label: string
  items: StatsItemView[]
  /** A small upper-case line over the heading; absent: none. */
  eyebrow?: string
  /** A short hand note beside the heading; absent: none. */
  note?: HandNoteView
}

export interface StatsItemView {
  value: string
  label: string
  text: string | null
  /** Its icon over the value, only while the strip's `icons` is on and one is picked. */
  icon?: SectionIcon | null
}

/**
 * Numbered steps as a theme draws them (`steps`, adr/0077 §10): a heading,
 * an optional intro, three to six steps in the shop's order as an ordered
 * list, each its printed number ("01" or "1", from `numbers`), title and
 * optional line, and one optional link under them. The storefront leaves
 * out a section with no step.
 */
export interface StepsSectionView extends StepsSettings {
  id: string
  type: "steps"
  /** The shop's heading, else the storefront's own words. */
  title: string
  intro: string | null
  items: StepsItemView[]
  link: LinkView | null
}

export interface StepsItemView {
  /** As printed: "01" or "1"; a screen reader hears the list's own order. */
  number: string
  title: string
  text: string | null
}

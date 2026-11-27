import type {
  PhotoCollageSettings,
  SectionIcon,
  StatsSettings,
  StepsSettings,
} from "@qticaret/types"
import type {
  BodySectionBase,
  LayoutImage,
  LayoutLink,
} from "@/features/storefront/api/layout-sections"

// The figures strip and the numbered steps of the theme editor's document (adr/0077 §10)

/** One figure: its value set large ("20 yıl"), its label and an optional line. */
export interface StatsItem {
  value: string
  /** May hold the shop's details (`{mağaza_adı}`). */
  label: string
  text: string | null
  /** Its icon (adr/0077 §10 Ek), drawn while the strip shows icons; absent: none. */
  icon?: SectionIcon
}

/** Two to six figures with an optional heading; its ground and alignment are the look's. */
export type StatsSection = BodySectionBase & {
  type: "stats"
  title: string | null
  items: StatsItem[]
  /** A small upper-case line over the heading; absent or null: none. */
  eyebrow?: string | null
  /** A short hand note beside the heading; absent or null: none. */
  note?: string | null
} & StatsSettings

/** One step: its title and an optional line; the theme numbers it. */
export interface StepsItem {
  title: string
  text: string | null
}

/** Three to six numbered steps under a heading and an intro, one optional link under them. */
export type StepsSection = BodySectionBase & {
  type: "steps"
  /** None: the storefront's own words. */
  title: string | null
  intro: string | null
  items: StepsItem[]
  link: LayoutLink | null
} & Omit<StepsSettings, "connector"> &
  Partial<Pick<StepsSettings, "connector">>

/** One photograph of a collage: a library picture with its words, an optional caption and link. */
export interface PhotoCollageItem {
  /** Null only while the shop is choosing one (the save needs it). */
  image: LayoutImage | null
  /** May hold the shop's details (`{mağaza_adı}`). */
  caption: string | null
  link: LayoutLink | null
  /** The white card's small line under the name (`card: below`); absent or null: none. */
  subtitle?: string | null
}

/** Three to seven photographs under an optional heading and intro (adr/0077 §10). */
export type PhotoCollageSection = BodySectionBase & {
  type: "photo_collage"
  title: string | null
  intro: string | null
  items: PhotoCollageItem[]
  /** A small upper-case line over the heading; absent or null: none. */
  eyebrow?: string | null
  /** The whole list's link beside the heading; absent or null: none. */
  more?: LayoutLink | null
} & PhotoCollageSettings

/**
 * The category cards' `linked` variant (adr/0049 Ek 2026-11-15): each
 * category a card with its picture (beside, above or none), its name, its
 * first subcategories as links and a "see all" link. Every setting is a
 * closed list or a bounded count; the defaults are
 * `CATEGORY_CARD_DEFAULTS`. The contract's list: a new step goes here first, then into the
 * backend's schema (`lib/storefront/sections/categories.ts`, a mirror a
 * test keeps equal), then into the themes. The panel's Turkish names are
 * `storefront.editor.categoryCards.<setting>.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-categories` subpath, which Turbopack resolves).
 */
import type { SectionIcon } from "./section-icons.js"

export const CATEGORY_CARD_SETTINGS = {
  /** Cards in a row on a wide screen; a tablet shows two. */
  columns: [2, 3, 4],
  /** Cards in a row on a phone (`columns_mobile`, bilesen-denetimi (b) 3): one, as before, or two. */
  columns_mobile: [1, 2],
  /** Where the category's picture stands: beside the words, above them, or none. */
  image_position: ["side", "top", "none"],
  /** The card's edge: a hairline frame, or plain on the page. */
  frame: ["lined", "plain"],
} as const satisfies Record<string, readonly [string | number, ...(string | number)[]]>

export type CategoryCardSetting = keyof typeof CATEGORY_CARD_SETTINGS
export type CategoryCardStep<S extends CategoryCardSetting> =
  (typeof CATEGORY_CARD_SETTINGS)[S][number]

/** Subcategory links under each card's name: none to eight, five by default. */
export const CATEGORY_CARD_LIMITS = { links: { min: 0, max: 8, default: 5 } } as const

/** A card section switched to `linked`, and what a reader takes for a field it lacks. */
export const CATEGORY_CARD_DEFAULTS = {
  columns: 3,
  columns_mobile: 1,
  image_position: "side",
  frame: "lined",
  links: CATEGORY_CARD_LIMITS.links.default,
} as const satisfies {
  [S in CategoryCardSetting]: CategoryCardStep<S>
} & { links: number }

/**
 * The `collage` variant (adr/0049 Ek 2026-11-15): each category a card
 * led by its photograph, its name under it, its count and its first
 * subcategories as quiet links; rows filled edge to edge, the first card
 * twice as wide and its row taller while `lead` is on. `columns` and
 * `columns_mobile` keep their meaning (cards in a row, the lead counting
 * two); `height` is the photo's, in the dictionary's steps
 * (bilesen-standardi §3); `lead` is a named switch (off/on).
 */
export const CATEGORY_COLLAGE_SETTINGS = {
  columns: CATEGORY_CARD_SETTINGS.columns,
  columns_mobile: CATEGORY_CARD_SETTINGS.columns_mobile,
  height: ["low", "medium", "high"],
  lead: ["off", "on"],
} as const satisfies Record<string, readonly [string | number, ...(string | number)[]]>

export type CategoryCollageSetting = keyof typeof CATEGORY_COLLAGE_SETTINGS
export type CategoryCollageStep<S extends CategoryCollageSetting> =
  (typeof CATEGORY_COLLAGE_SETTINGS)[S][number]

/** A section switched to `collage`, and what a reader takes for a field it lacks. */
export const CATEGORY_COLLAGE_DEFAULTS = {
  columns: 4,
  columns_mobile: 1,
  height: "medium",
  lead: "on",
  links: 4,
} as const satisfies {
  [S in CategoryCollageSetting]: CategoryCollageStep<S>
} & { links: number }

/** `collage`'s own fields as `GET /store/storefront-layout` prints them. */
export interface StoreCategoriesCollage {
  variant: "collage"
  columns: CategoryCollageStep<"columns">
  /** Printed only when not the default (1). */
  columns_mobile?: CategoryCollageStep<"columns_mobile">
  height: CategoryCollageStep<"height">
  lead: CategoryCollageStep<"lead">
  /** Subcategory links under each card's name at most (0–8, `CATEGORY_CARD_LIMITS`). */
  links: number
}

/**
 * The `panels` variant (adr/0049 Ek 2026-11-19): each category a graphite
 * panel led by its photograph, no frame round it; the name, count and
 * first subcategories on the panel's graphite, never on the photo. While
 * `lead` is on the first panel stands tall on the left from 1024 px and
 * the others stack beside it; `columns` then has no say (it lays out the
 * rows while `lead` is off). The steps are the collage's own lists (one
 * concept, one list); the defaults are this variant's.
 */
export const CATEGORY_PANELS_SETTINGS = CATEGORY_COLLAGE_SETTINGS

/** A section switched to `panels`, and what a reader takes for a field it lacks. */
export const CATEGORY_PANELS_DEFAULTS = {
  columns: 3,
  columns_mobile: 1,
  height: "medium",
  lead: "on",
  links: 4,
} as const satisfies {
  [S in CategoryCollageSetting]: CategoryCollageStep<S>
} & { links: number }

/** `panels`' own fields as `GET /store/storefront-layout` prints them (the collage's, renamed). */
export interface StoreCategoriesPanels extends Omit<StoreCategoriesCollage, "variant"> {
  variant: "panels"
}

/** `linked`'s own fields as `GET /store/storefront-layout` prints them. */
export interface StoreCategoriesLinked {
  variant: "linked"
  columns: CategoryCardStep<"columns">
  /** Printed only when not the default (1): a backend before it sends none. */
  columns_mobile?: CategoryCardStep<"columns_mobile">
  image_position: CategoryCardStep<"image_position">
  frame: CategoryCardStep<"frame">
  /** Subcategory links under each card's name at most (0–8). */
  links: number
}

/**
 * The `icons` variant (adr/0077 §10 Ek, "ikonlu bölümler"): the categories
 * in one row, each a round light disc holding its icon and its name under
 * it. Each category's icon is picked in the section (`category_icons`, by
 * category id, from `SECTION_ICONS`), never on the category; one with none
 * shows its own picture in the disc, else its name's first letter.
 * `disc`: the disc's ground, the main colour's light tint (`tint`), the
 * page's quiet field (`well`) or a hairline ring (`line`). `phone`: on a
 * narrow screen the row slides sideways (`scroll`) or wraps onto more rows
 * (`wrap`). The categories named, else the top ones; their count under the
 * name while `show_count` is on.
 */
export const CATEGORY_ICONS_SETTINGS = {
  disc: ["tint", "well", "line"],
  phone: ["scroll", "wrap"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type CategoryIconsSetting = keyof typeof CATEGORY_ICONS_SETTINGS
export type CategoryIconsStep<S extends CategoryIconsSetting> =
  (typeof CATEGORY_ICONS_SETTINGS)[S][number]

/** A section switched to `icons`, and what a reader takes for a field it lacks. */
export const CATEGORY_ICONS_DEFAULTS: {
  readonly [S in CategoryIconsSetting]: CategoryIconsStep<S>
} = {
  disc: "tint",
  phone: "scroll",
}

/** `icons`' own fields as `GET /store/storefront-layout` prints them. */
export interface StoreCategoriesIcons {
  variant: "icons"
  disc: CategoryIconsStep<"disc">
  phone: CategoryIconsStep<"phone">
  /** Each picked icon by category id; a category with none is absent. */
  category_icons: Record<string, SectionIcon>
  /**
   * Icons by category handle (a preset's: it cannot know a shop's ids),
   * read after `category_icons`: an id's icon wins, then its handle's, then
   * the picture or initial. Absent while none is written (an older backend too).
   */
  category_icons_by_handle?: Record<string, SectionIcon>
}

/** The icon row's settings as a reader takes them: one missing or off the list reads as its default. */
export function categoryIconsSettingsOf(section: Partial<Record<CategoryIconsSetting, unknown>>): {
  [S in CategoryIconsSetting]: CategoryIconsStep<S>
} {
  const step = <S extends CategoryIconsSetting>(name: S): CategoryIconsStep<S> => {
    const steps: readonly unknown[] = CATEGORY_ICONS_SETTINGS[name]
    return steps.includes(section[name])
      ? (section[name] as CategoryIconsStep<S>)
      : CATEGORY_ICONS_DEFAULTS[name]
  }
  return { disc: step("disc"), phone: step("phone") }
}

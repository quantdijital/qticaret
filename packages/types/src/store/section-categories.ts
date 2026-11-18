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

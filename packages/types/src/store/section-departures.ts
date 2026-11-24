/**
 * Upcoming departures (`departures`, adr/0077 §10): the nearest departures
 * of the shop's dated products still on sale, each a date, the product's
 * name, the places left when few and the lowest paying price, read live
 * from `GET /store/departures`. A flagged section (adr/0077 §8): only
 * while `catalog.booking` is on (`section-requires.ts`). The contract's
 * list: a new setting goes here first, then into the backend's mirror
 * (`lib/storefront/sections/departures.ts`, a test keeps them equal),
 * then into the themes. The panel's Turkish names are
 * `storefront.editor.departures.<setting>.*`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-departures` subpath).
 */

/** How many departures, and the intro's longest text. */
export const DEPARTURES_LIMITS = {
  limit: { min: 3, max: 12, default: 6 },
  intro: 240,
  /** A product's departures in one list at most, so one tour does not fill it. */
  per_product: 2,
} as const

export const DEPARTURES_SETTINGS = {
  /** `list`: a date box, the tour's name, places left, price and "İncele" per row; `cards`: a card each. */
  layout: ["list", "cards"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type DeparturesSetting = keyof typeof DEPARTURES_SETTINGS
export type DeparturesStep<S extends DeparturesSetting> = (typeof DEPARTURES_SETTINGS)[S][number]

/** A new section's settings, and what one without them reads as. */
export const DEPARTURES_DEFAULTS: { readonly [S in DeparturesSetting]: DeparturesStep<S> } = {
  layout: "list",
}

export const DEPARTURES_SETTING_NAMES = Object.keys(DEPARTURES_SETTINGS) as DeparturesSetting[]

export type DeparturesSettings = { [S in DeparturesSetting]: DeparturesStep<S> }

/** Every setting as a reader takes it: one missing or off this build's list reads as its default. */
export function departuresSettingsOf(
  section: Partial<Record<DeparturesSetting, unknown>>
): DeparturesSettings {
  const settings: Partial<Record<DeparturesSetting, string>> = {}
  for (const name of DEPARTURES_SETTING_NAMES) {
    const steps: readonly unknown[] = DEPARTURES_SETTINGS[name]
    settings[name] = steps.includes(section[name])
      ? (section[name] as string)
      : DEPARTURES_DEFAULTS[name]
  }
  return settings as DeparturesSettings
}

/** Whose departures: every dated product, a category's (its shown subtree) or a collection's. */
export type DeparturesSource =
  | { kind: "all" }
  | { kind: "category"; category_id: string }
  | { kind: "collection"; collection_id: string }

/** Upcoming departures in `GET /store/storefront-layout`. */
export type StoreDeparturesSection = {
  id: string
  type: "departures"
  /** None: the storefront's own words ("Yaklaşan kalkışlar"). */
  title: string | null
  intro: string | null
  source: DeparturesSource
  /** How many departures at most (`DEPARTURES_LIMITS.limit`). */
  limit: number
} & Partial<DeparturesSettings>

/** One departure of `GET /store/departures`. */
export interface StoreUpcomingDeparture {
  product: { id: string; handle: string; title: string; thumbnail: string | null }
  slot_id: string
  /** ISO time; told in `timezone`, the product's. */
  starts_at: string
  timezone: string
  /** Places left, only when few (at most `FEW_PLACES_LEFT`); else null. */
  left: number | null
  /** The lowest paying place on it, a guest's, in lira as the card's `from_price` (1750.5); null: none. */
  from_price: number | null
}

/** "Son N yer" from this many places free (the card's and the product page's rule, adr/0076 §10). */
export const FEW_PLACES_LEFT = 5

/**
 * `GET /store/departures?limit=&category_id=|kategori=&collection_id=`
 * (adr/0077 §10), only while the shop sells dated products: the nearest
 * departures on sale (open, sales not closed, a place free) of published
 * products in the shopper's sales channels, by date, at most
 * `DEPARTURES_LIMITS.per_product` each. Lira only.
 */
export interface StoreUpcomingDepartures {
  currency: "try"
  departures: StoreUpcomingDeparture[]
}

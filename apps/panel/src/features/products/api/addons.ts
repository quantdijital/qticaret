/**
 * A product's add-ons (adr/0052): what a shopper picks beside the variant,
 * a typed text or one of a few choices, each priced per unit in lira (KDV
 * included) and charged on the server. Saved with the product's catalog
 * fields; the server gives new ones their ids and keeps the ids sent,
 * which cart lines name them by.
 */

export const ADDON_KINDS = ["text", "choice"] as const
export type AddonKind = (typeof ADDON_KINDS)[number]

/** `letters_digits`: letters (Turkish too), digits, spaces; `text` adds `. , ' - &`. */
export const ADDON_CHARSETS = ["letters_digits", "text"] as const
export type AddonCharset = (typeof ADDON_CHARSETS)[number]

/** The server's limits (lib/catalog/addons/schema.ts). */
export const ADDON_LIMITS = {
  addons: 5,
  label: 60,
  help: 160,
  choicesMin: 2,
  choicesMax: 10,
  textMax: 200,
  textDefault: 50,
  quantityMax: 99,
  price: 10_000,
} as const

export interface AddonChoice {
  id: string
  label: string
  price: number
}

interface AddonCommon {
  id: string
  label: string
  help: string | null
  required: boolean
  /** Units a cart line may hold with it; null: no limit. */
  max_quantity: number | null
  /** Made to the buyer's wish: the line is outside the right of withdrawal. */
  non_withdrawable: boolean
}

/** An add-on as `GET /admin/products/:id/catalog` returns it. */
export type ProductAddon = AddonCommon &
  (
    | { kind: "text"; price: number; text: { max_length: number; charset: AddonCharset } }
    | { kind: "choice"; choices: AddonChoice[] }
  )

type WithoutId<T> = Omit<T, "id"> & { id?: string }

/** An add-on as the catalog save takes it: a new one (and a new choice) without an id. */
export type AddonInput = WithoutId<AddonCommon> &
  (
    | { kind: "text"; price: number; text: { max_length: number; charset: AddonCharset } }
    | { kind: "choice"; choices: WithoutId<AddonChoice>[] }
  )

/** The flag the shop turns add-ons on with (Settings > Features). */
export const ADDONS_FLAG = "catalog.addons"

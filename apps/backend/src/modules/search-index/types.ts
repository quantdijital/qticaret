import type { SearchFields } from "../../lib/search/document"

/** Raw SQL through the module's own connection, `?` placeholders bound by the driver. */
export interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** One product's row as the indexing workflow writes it (adr/0056). */
export interface DocumentInput {
  product_id: string
  published: boolean
  /** The title as compared. */
  title: string
  fields: SearchFields
  /** Each distinct word: as compared, as it reads, in a title. */
  vocabulary: [string, string, boolean][]
  sales_channel_ids: string[]
  /** Every category the product is in, shown or not (listings narrow by the shown tree). */
  category_ids: string[]
  /** The shown ones, named: search's related chips. */
  categories: { id: string; name: string }[]
  collection_id: string | null
  brand: { id: string; handle: string; name: string } | null
  /** `key=value` for each choice attribute's option. */
  options: string[]
  /** The lowest selling price per `region_id:currency`, whole units with decimals. */
  prices: Record<string, number>
  in_stock: boolean
  /**
   * Shown as a discount now in the shop's currency (adr/0023 Ek 2026-11-05):
   * a price list's or an automatic promotion's, by the price-before rule.
   */
  on_sale: boolean
  product_created_at: string
  /** Kept as it is when left out: orders count it, not the catalogue. */
  popularity?: number
}

export interface StoredDocument extends DocumentInput {
  popularity: number
}

export interface PendingClaim {
  product_id: string
  version: string
}

/** What a listing or a search asks of the index (built by the listing workflow). */
export interface ListingPlan {
  /** The shopper's sales channels; null counts every channel (a listing's resolve). */
  channels: string[] | null
  scope: {
    category_ids?: string[]
    brand_id?: string
    collection_id?: string
    product_ids?: string[]
    /** A landing page's attribute facet, `key=value`. */
    option?: string
    /** Only the products on sale now (`/kampanyalar`). */
    on_sale?: true
  }
  text: {
    /** What a product must match. */
    match: string
    /** Per unit, its ways and their weights. */
    units: { query: string; weight: number }[][]
    /** The query as compared, joining words kept. */
    phrase: string
  } | null
  filters: {
    brands: string[] | null
    options: { key: string; values: string[] }[]
    in_stock: boolean
  }
  price: { key: string; min: number | null; max: number | null }
  sort: "relevance" | "newest" | "price_asc" | "price_desc"
  page: { offset: number; limit: number }
  /** Only the count (a listing's resolve, a page past the last). */
  countOnly?: boolean
  /** Related chips from the first this many hits by relevance (search). */
  related?: number
}

export interface FacetCount {
  value: string
  count: number
}

export interface ListingResult {
  count: number
  ids: string[]
  brands: { handle: string; name: string; count: number }[]
  /** `key=value` counts under every filter. */
  options: FacetCount[]
  /** A filtered key's own counts, without its filter. */
  ownOptions: Record<string, FacetCount[]>
  /** Products in stock under every filter but availability. */
  inStock: number
  price: { min: number; max: number } | null
  related: {
    categories: { id: string; name: string }[]
    brands: { id: string; name: string; handle: string }[]
  } | null
}

/** A word's facts from the dictionary and the stemmer (analyse). */
export interface AnalysedWord {
  norm: string
  stem: string | null
  display: string | null
  roots: string[]
  alike: { word: string; display: string; similarity: number; titles: number }[]
}

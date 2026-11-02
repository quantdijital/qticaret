/**
 * The Store API's SEO answers as the storefront reads them (adr/0046 §8).
 * Mirrors of the backend's own types; kept in step by hand and by tests:
 * - `SeoPayload`: apps/backend/src/lib/seo/resolve.ts
 * - `Resolution`, `ListingView`: apps/backend/src/workflows/seo/redirects/resolve.ts,
 *   apps/backend/src/workflows/seo/listing-resolution.ts
 */

export type RobotsValue = "index,follow" | "noindex,follow" | "noindex,nofollow"

/** A JSON-LD block, ready to print (docs/13 §5). */
export type JsonLd = Record<string, unknown>

export interface SeoPayload {
  title: string
  description: string
  /** Absolute; null until the shop sets its canonical host. */
  canonical: string | null
  robots: RobotsValue
  openGraph: {
    title: string
    description: string
    image: string | null
    imageAlt: string | null
    type: "product" | "article" | "website"
    url: string | null
    siteName: string
  }
  twitter: {
    card: "summary_large_image" | "summary"
    title: string
    description: string
    image: string | null
  }
  breadcrumbs: { name: string; url: string }[]
  jsonLd: JsonLd[]
  /** Empty until F19. */
  hreflang: { locale: string; url: string }[]
}

export type ListingSort = "yeni" | "fiyat-artan" | "fiyat-azalan"

/** A listing page's query as the backend read it (docs/13 §7). */
export interface ListingView {
  filters: Record<string, string[]>
  price: { min: number | null; max: number | null } | null
  sort: ListingSort | null
  /** 1 for the first page. */
  page: number
  page_size: number
}

export type EntityType =
  | "product"
  | "product_category"
  | "product_collection"
  | "brand"
  | "page"
  | "post"
  | "landing"
  // A blog archive (adr/0019 ek 2026-11-03): `/blog/kategori/{handle}`, `/blog/etiket/{handle}`
  | "post_category"
  | "post_tag"
  // The products on sale now (`/kampanyalar`), its id `sale`
  | "sale"

export type Resolution =
  | {
      type: "entity"
      path: string
      entity_type: EntityType
      entity_id: string
      seo?: SeoPayload | null
      listing?: ListingView
    }
  | { type: "redirect"; path: string; status: 301 | 302 | 307; location: string }
  | { type: "gone"; path: string }
  | { type: "not_found"; path: string | null }

/**
 * Whether the shop is dark (adr/0053), in `GET /store/seo/site`. While it
 * is off every field but `enabled` is empty: a prepared text never shows.
 */
export interface SiteMaintenance {
  enabled: boolean
  /** null: the storefront's own heading. */
  title: string | null
  /** The shop's `{belirteç}`s already filled; null: the storefront's own words. */
  message: string | null
  /** ISO 8601 with its offset: the storefront's `Retry-After` while it is ahead. */
  expected_at: string | null
  /** Open besides the storefront's own: exact (`/iletisim`) or with what is below (`/sozlesmeler/*`). */
  allow_paths: string[]
}

/** `GET /store/seo/site`: what every page of the storefront needs. */
export interface SiteSeo {
  canonical_host: string | null
  indexing: boolean
  indexnow_key: string | null
  /** The home page's `OnlineStore` and `WebSite`; empty until a canonical host is set. */
  jsonLd: JsonLd[]
  system_pages: { path: string; robots: RobotsValue }[]
  /** Absent from a backend before adr/0053: the shop is open. */
  maintenance?: SiteMaintenance
  /**
   * The measurement tags the shop connected (F10.9, docs/20 "vitrin dönüşüm
   * olayları"): their public ids only, never a secret; null: not connected.
   * Absent from a backend that does not say yet: none.
   */
  tracking?: SiteTracking
}

/** The public ids of the shop's measurement tags; the storefront loads each only with the visitor's consent. */
export interface SiteTracking {
  /** GA4's web stream (`G-XXXX`). */
  ga4_measurement_id: string | null
  /** Meta's pixel (digits). */
  meta_pixel_id: string | null
}

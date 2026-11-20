import type { SummaryDoc } from "../catalog/summary"
import type { ContentDoc } from "../content/doc"

/**
 * A shop's data as a migration source gives it (F14, adr/0042 §1): every
 * source (Shopify, a Turkish platform's export, a sheet) turns its own
 * format into these records. Each has the source's own key, so a run
 * that stopped half-way carries on without making a record twice.
 * Amounts are lira as the shop showed them (KDV included), as text.
 */

/** A path on the old site, kept to send its visitors (and search engines) on with a 301. */
export type OldPath = string

export interface SourceCategory {
  source_key: string
  /** From the top: ["Mutfak", "Tavalar"]. */
  path: string[]
  /**
   * The handle wanted: the old slug where the source keeps one, so the
   * address stays alike; none: made from the name.
   */
  handle?: string | null | undefined
  description: string | null
  old_url: OldPath | null
}

export interface SourceBrand {
  source_key: string
  name: string
  old_url: OldPath | null
}

/** A variant's stock at the source (see `SourceVariant.stock`). */
export type SourceStock = number | "untracked" | null

export interface SourceVariant {
  source_key: string
  sku: string | null
  barcode: string | null
  /** KDV included, as the shop sold it. */
  price: string
  /** The crossed-out price, when the source had one. */
  compare_at_price: string | null
  /**
   * The count the source kept; `"untracked"` where it counted none and
   * sold it (always sellable here: `manage_inventory: false`, written
   * `Takipsiz` in the sheet); null where it is unknown (counted here from
   * nothing). One shown out of stock is 0.
   */
  stock: SourceStock
  /** Option name to value, in the product's option order. */
  options: Record<string, string>
  /** Grams. */
  weight: number | null
  /**
   * The variant's own picture at the source (a WooCommerce variation's
   * image), one of the product's `images`: tied to the variant here, so
   * choosing it shows its photo. None: the product's pictures serve it.
   */
  image?: string
}

export interface SourceProduct {
  source_key: string
  /** The handle wanted: the old slug where there was one, so URLs stay alike. */
  handle: string
  title: string
  /** Plain text: a source's HTML turned to text, or its document's text (adr/0055). */
  description: string | null
  /**
   * The description as a content document, where the source's HTML gives
   * one (WordPress, Shopify; adr/0055): written beside the plain text, which
   * is the document's own.
   */
  description_doc?: ContentDoc | null | undefined
  /**
   * The short description as a document (adr/0055 Ek 2026-11-06), where
   * the source keeps one (WooCommerce's excerpt): null for a product
   * without; left out by a source that never has one.
   */
  summary_doc?: SummaryDoc | null | undefined
  status: "published" | "draft"
  /** Category paths, the first the product's main one. */
  categories: string[][]
  brand: string | null
  seo_title: string | null
  seo_description: string | null
  /** The search phrase the page was written for, when the source kept one. */
  focus_keyword?: string | null | undefined
  /** The product's pictures as the old site served them, the first the main one. */
  images: string[]
  /** A picture's alt text as the old site gave it, by its address; the rest take the product's name. */
  image_alts?: Readonly<Record<string, string>> | undefined
  /** Up to three options, in order, with their values. */
  options: { name: string; values: string[] }[]
  variants: SourceVariant[]
  /** The parcel's measurements in cm, when the source keeps them (most do not). */
  dimensions: { length: number; width: number; height: number } | null
  old_url: OldPath | null
}

/**
 * The parcel a product without its own measurements is sent in, as the
 * owner gives it for a run: grams and cm, written into the product's own
 * fields. Optional: without it such a product ships as the shop's default
 * parcel (Settings > Shipping, adr/0054).
 */
export interface PackageDefaults {
  weight: number
  length: number
  width: number
  height: number
}

export interface SourceAddress {
  first_name: string | null
  last_name: string | null
  company: string | null
  address_1: string | null
  address_2: string | null
  /** İlçe. */
  city: string | null
  /** İl. */
  province: string | null
  postal_code: string | null
  phone: string | null
}

export interface SourceCustomer {
  source_key: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  addresses: SourceAddress[]
  /**
   * When the customer agreed to commercial e-mail or texts, as the source
   * recorded it; null when it holds no such record (then no consent is
   * assumed: adr/0042 §5).
   */
  marketing: { email: Date | null; sms: Date | null } | null
  created_at: Date | null
}

/** An order from the old platform: shown on the customer's page, never a live order (adr/0042 §4). */
export interface SourceOrder {
  source_key: string
  number: string
  created_at: Date
  /** ISO 4217, lower-case. */
  currency: string
  total: string
  status: string
  customer_email: string | null
  lines: { title: string; sku: string | null; quantity: number; total: string }[]
}

export interface SourceReview {
  source_key: string
  product_source_key: string
  author: string | null
  /** The author's e-mail, when the source has it: the review is tied to the customer it moved as. */
  customer_email: string | null
  /** 1 to 5. */
  rating: number
  title: string | null
  body: string
  /** Whether the old site showed it; one waiting there waits here too. */
  published: boolean
  created_at: Date
}

/**
 * A content page's or blog post's own text, as a source that has it gives
 * it (a WordPress export): made a page or post here, its old address sent
 * on to it.
 */
export interface SourceContent {
  /** The handle wanted: the old slug, so the address stays alike. */
  handle: string
  /** A checked document (lib/content): pictures left out, they must be the shop's own uploads. */
  body: ContentDoc
  excerpt: string | null
  author: string | null
  status: "published" | "draft"
  /** When it went live there: kept as its publishing date. */
  published_at: Date | null
  /** Its cover picture as the old site served it. */
  cover: { url: string; alt: string | null } | null
  seo_title: string | null
  seo_description: string | null
  focus_keyword: string | null
  /** The old site kept it out of search results. */
  robots: "noindex_follow" | "noindex_nofollow" | null
}

/** An old page that maps to no product, category or brand: a content page, a campaign. */
export interface SourcePage {
  source_key: string
  title: string
  old_url: OldPath
  /** Its text, when the source has it: then it is made a content page here, else only its address moves. */
  content?: SourceContent | null | undefined
}

/** A blog post's category or tag (adr/0019 ek 2026-11-03). */
export interface SourcePostTerm {
  source_key: string
  name: string
  /** The old slug, so the archive's address stays alike. */
  handle: string
  /** Plain text, one line. */
  description: string | null
  seo_title: string | null
  seo_description: string | null
  old_url: OldPath | null
}

/** A blog post (F3.16): written here with its category and tags. */
export interface SourcePost {
  source_key: string
  title: string
  content: SourceContent
  category: SourcePostTerm | null
  tags: SourcePostTerm[]
  old_url: OldPath | null
}

export const MIGRATION_KINDS = [
  "category",
  "brand",
  "product",
  "image",
  "customer",
  "order",
  "review",
  "page",
  "post",
  "post_category",
  "post_tag",
] as const
export type MigrationKind = (typeof MIGRATION_KINDS)[number]

/**
 * A shop's old platform, read page by page (adr/0042 §1). It only reads;
 * every list may be empty for a source that holds no such records.
 */
export interface MigrationSource {
  readonly id: string
  categories(): AsyncIterable<SourceCategory>
  brands(): AsyncIterable<SourceBrand>
  products(): AsyncIterable<SourceProduct>
  customers(): AsyncIterable<SourceCustomer>
  orders(): AsyncIterable<SourceOrder>
  reviews(): AsyncIterable<SourceReview>
  pages(): AsyncIterable<SourcePage>
  /** Blog posts with their categories and tags; a source without a blog leaves it out. */
  posts?(): AsyncIterable<SourcePost>
  /** Records the source left out as it read them, and why: the report's notes. */
  notes?(): readonly (StepProblem & { kind: MigrationKind })[]
}

/**
 * How far a step is (`done` of `total`), as it goes: the job's progress,
 * and its heartbeat (a job silent for ten minutes is taken for dead).
 */
/** A source record a step left out, and why (an error key): the report's problem rows. */
export interface StepProblem {
  source_key: string
  key: string
}

export type StepProgress = (done: number, total: number) => Promise<void>

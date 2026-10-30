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
  description: string | null
  old_url: OldPath | null
}

export interface SourceBrand {
  source_key: string
  name: string
  old_url: OldPath | null
}

export interface SourceVariant {
  source_key: string
  sku: string | null
  barcode: string | null
  /** KDV included, as the shop sold it. */
  price: string
  /** The crossed-out price, when the source had one. */
  compare_at_price: string | null
  stock: number | null
  /** Option name to value, in the product's option order. */
  options: Record<string, string>
  /** Grams. */
  weight: number | null
}

export interface SourceProduct {
  source_key: string
  /** The handle wanted: the old slug where there was one, so URLs stay alike. */
  handle: string
  title: string
  /** Plain text; a source's HTML is turned to text before it gets here. */
  description: string | null
  status: "published" | "draft"
  /** Category paths, the first the product's main one. */
  categories: string[][]
  brand: string | null
  seo_title: string | null
  seo_description: string | null
  /** The product's pictures as the old site served them, the first the main one. */
  images: string[]
  /** Up to three options, in order, with their values. */
  options: { name: string; values: string[] }[]
  variants: SourceVariant[]
  /** The parcel's measurements in cm, when the source keeps them (most do not). */
  dimensions: { length: number; width: number; height: number } | null
  old_url: OldPath | null
}

/**
 * The parcel a product without its own measurements is sent in, as the
 * owner gives it for a run: grams and cm. A product going live needs them
 * (F3.1, the carriers' desi).
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

/** An old page that maps to no product, category or brand: a content page, a campaign. */
export interface SourcePage {
  source_key: string
  title: string
  old_url: OldPath
}

export const MIGRATION_KINDS = [
  "category",
  "brand",
  "product",
  "customer",
  "order",
  "review",
  "page",
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

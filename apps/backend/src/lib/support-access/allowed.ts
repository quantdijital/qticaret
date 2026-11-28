import type { Method, Rule } from "../staff/permission-rules"

/**
 * What a "Platform desteği" session reaches at all (adr/0061 Ek "Destek
 * erişimi", Karar 5; security review M-B): an allow-list, so a route not
 * named here is refused, a new one included, until someone decides. The
 * session's work is the catalogue and the storefront's looks; orders and
 * customers are read only (customers a page at a time); the rest is what
 * the panel needs to draw itself. The deny list (`permissions.ts`) is
 * checked first and wins.
 */

const READS: readonly Method[] = ["GET", "HEAD", "OPTIONS"]
const ANY = "*" as const

const any = (...paths: string[]): Rule[] => paths.map((path) => ({ methods: ANY, path }))
const reads = (...paths: string[]): Rule[] => paths.map((path) => ({ methods: READS, path }))

/** Settings sections a support session reads. */
export const SUPPORT_READ_SECTIONS = [
  "appearance",
  "theme",
  "storefront",
  "catalog",
  "seo",
  "product_badges",
  "inventory",
  "panel_layout",
  "store",
  "legal",
  "shipping",
  "maintenance",
  "ai_scenes",
] as const

/** Settings sections a support session writes: the looks and the catalogue's own. */
export const SUPPORT_WRITE_SECTIONS = [
  "appearance",
  "theme",
  "storefront",
  "catalog",
  "seo",
  "product_badges",
  "inventory",
  "panel_layout",
] as const

/** A page of customers at most this long (security review L3). */
export const SUPPORT_PAGE_MAX = 50

export const SUPPORT_ALLOWED: readonly Rule[] = [
  // The catalogue
  ...any(
    "/admin/products*",
    "/admin/product-categories*",
    "/admin/collections*",
    "/admin/brands*",
    "/admin/product-tags*",
    "/admin/product-options*",
    "/admin/inventory-items*",
    "/admin/stock-items*",
    "/admin/stock-board*",
    "/admin/product-board*",
    "/admin/catalog*",
    "/admin/attribute-templates*",
    "/admin/addon-templates*",
    "/admin/description-facts*",
    "/admin/category-counts*",
    "/admin/category-descriptions*",
    "/admin/category-images*",
    "/admin/category-restrictions*",
    "/admin/collection-board*",
    "/admin/sample-catalog*",
    "/admin/search/synonyms*"
  ),
  // The storefront's looks, its pages, menus, media and search appearance
  ...any(
    "/admin/storefront-layout*",
    "/admin/storefront-designs*",
    "/admin/storefront-presets*",
    "/admin/storefront-menus*",
    "/admin/content*",
    "/admin/landings*",
    "/admin/popups*",
    "/admin/media*",
    "/admin/seo*"
  ),
  { methods: ["POST"], path: "/admin/uploads" },
  ...reads("/admin/uploads/:id"),
  // Moderating reviews and questions
  ...any("/admin/product-reviews*", "/admin/product-questions*", "/admin/product-answers*"),
  // Writing help for the catalogue
  ...any("/admin/ai/suggestions*", "/admin/ai/seo-fill*"),
  ...reads("/admin/ai/services"),
  // Queued jobs: its own list, a job, cancelling one; which kinds start is the deny list's
  ...reads("/admin/async-jobs", "/admin/async-jobs/:id"),
  { methods: ["POST"], path: "/admin/async-jobs" },
  { methods: ["POST"], path: "/admin/async-jobs/:id/cancel" },
  // Settings it reads, and the few it writes
  ...reads(...SUPPORT_READ_SECTIONS.map((section) => `/admin/platform-settings/${section}`)),
  { methods: ["POST"], path: "/admin/platform-settings/:section" },
  // Orders and customers, read only
  ...reads("/admin/orders", "/admin/orders/:id", "/admin/order-board*"),
  ...reads("/admin/customers*", "/admin/customer-stats*", "/admin/customer-groups*"),
  // What the panel draws itself with
  ...reads(
    "/admin/home*",
    "/admin/dashboard*",
    "/admin/features*",
    "/admin/feature-flags*",
    "/admin/global-search*",
    "/admin/public-config*",
    "/admin/alerts*",
    "/admin/vat-rates*",
    "/admin/warehouses*",
    "/admin/tr-address*",
    "/admin/stock-locations*",
    "/admin/sales-channels*",
    "/admin/shipping-profiles*",
    "/admin/price-preferences*",
    "/admin/regions*",
    "/admin/currencies*",
    "/admin/stores*",
    "/admin/locales*",
    "/admin/product-types*"
  ),
]

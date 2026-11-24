/**
 * Feature flags (adr/0012). Code reads flags, never sector names; each phase
 * adds its own (`payments.cash_on_delivery` F6, `seo.publish_gate` F3.13...). A flag
 * a tenant changes in the admin is `owner: "tenant"`; one that provisioning
 * sets (plans, F17) is `owner: "platform"` and read-only in the admin.
 */

export type FeatureOwner = "tenant" | "platform"

export interface FeatureDefinition {
  default: boolean
  owner: FeatureOwner
  /** i18n keys for the admin, under `qticaret.features.` (src/admin/i18n). */
  labelKey: string
  descriptionKey: string
}

/** The flag key the code reads for digital and service products (F3.2). */
export const NON_PHYSICAL_PRODUCTS = "catalog.non_physical"

/** Announcing changed pages to IndexNow search engines (F3.15); calls go out of the shop. */
export const SEO_INDEXNOW = "seo.indexnow"

/** Refusing to publish a product the SEO advisor finds unready (F3.13, docs/14 §2). */
export const SEO_PUBLISH_GATE = "seo.publish_gate"

/** Selling a variant past its stock, as a preorder or from a supplier (F3.8, adr/0020). */
export const STOCK_PREORDER = "stock.preorder"

// F4.8 (ADR-0025): gift cards and store credit, off until the shop takes them on
export const GIFT_CARDS = "promotions.gift_cards"

/** Paying at the door (F6, adr/0029): off until the shop sets its fee and couriers. */
export const CASH_ON_DELIVERY = "payments.cash_on_delivery"

/**
 * Marking products and categories as sold to adults only (F13.4, adr/0041
 * §4): marked products name their adult consideration in JSON-LD and stay
 * out of the feeds.
 */
export const RESTRICTED_PRODUCTS = "catalog.restricted"

/** Asking a cart with a restricted product for the buyer's age (F13.3, adr/0041 §4). */
export const AGE_VERIFICATION = "compliance.age_verification"

/** Bulk e-mail and SMS to consented customers from the panel (adr/0050). */
export const MARKETING_CAMPAIGNS = "marketing.campaigns"

/** Product add-ons priced on the server, a typed text or a choice (adr/0052). */
export const PRODUCT_ADDONS = "catalog.addons"

/**
 * Dated products sold by departure, their places held in carts and booked
 * (adr/0076). Needs `catalog.non_physical`: a dated product is a service.
 */
export const CATALOG_BOOKING = "catalog.booking"

/**
 * Product collections (Ürünler > Koleksiyonlar): on by default, so a shop
 * keeps them. Off, their pages answer 404 and leave the sitemap, menus and
 * sections skip them and the admin's collection writes are refused; the
 * records stay and come back when it is on again.
 */
export const CATALOG_COLLECTIONS = "catalog.collections"

/**
 * Storefront pop-ups (adr/0080): on by default, so the screen is there;
 * nothing shows until the shop makes one and switches it on. Off, their
 * routes answer 404 and the storefront shows none; the records stay.
 */
export const MARKETING_POPUPS = "marketing.popups"

/** Orders staff make and the customer pays through a link (adr/0051). */
export const PAYMENT_LINKS = "orders.payment_links"

/** Wholesale customers and their prices (ADR-0068). */
export const CUSTOMERS_WHOLESALE = "customers.wholesale"

/** Product videos: clips the shop uploads and YouTube links (adr/0069). */
export const PRODUCT_VIDEOS = "catalog.product_videos"

/** AI with the shop's own service key, "bring your own key" (adr/0071 §6). */
export const AI_OWN_KEYS = "ai.own_keys"

/**
 * AI on what customers wrote: a product's reviews summed up, a reply to a
 * review and an answer to a question drafted (adr/0071 §6, §10; Aşama 9).
 * The shop's own consent, apart from connecting a service: off until it is
 * turned on.
 */
export const AI_REVIEWS = "ai.reviews"

/**
 * The storefront's "search in your own words" (adr/0077 §7): a shopper's
 * sentence read into the search's filters by the shop's own AI key. The
 * one exception to adr/0071 §10: a shopper's words go to the service, so
 * the shop turns it on itself; off until it does.
 */
export const AI_STOREFRONT_SEARCH = "ai.storefront_search"

/**
 * The panel assistant (adr/0079): staff's own words go to the shop's AI
 * service, so the owner turns it on (`permission-rules.ts` OWNER_ONLY);
 * off until they do.
 */
export const AI_ASSISTANT = "ai.assistant"

/**
 * Flags taken out of the registry. A shop may still hold a stored value for
 * one (an override row, a plan document's key); reads skip it as an unknown
 * key and nothing writes it again. `content.ai_drafts`: the drafts of
 * F10.13, replaced by the AI core (adr/0071, docs/22 Aşama 2).
 */
export const RETIRED_FEATURES: readonly string[] = Object.freeze(["content.ai_drafts"])

export const FEATURES: Readonly<Record<string, FeatureDefinition>> = Object.freeze({
  // F3.2: products that need no shipping (e-books, gift codes, courses, services)
  [NON_PHYSICAL_PRODUCTS]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.catalog_non_physical.label",
    descriptionKey: "qticaret.features.catalog_non_physical.description",
  },
  // F3.15: off until the shop turns it on, since it calls a service outside
  [SEO_INDEXNOW]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.seo_indexnow.label",
    descriptionKey: "qticaret.features.seo_indexnow.description",
  },
  // F3.13: off by default; the advisor's score shows either way
  [SEO_PUBLISH_GATE]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.seo_publish_gate.label",
    descriptionKey: "qticaret.features.seo_publish_gate.description",
  },
  // F3.8: off by default; a variant already selling past its stock may stay so
  [STOCK_PREORDER]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.stock_preorder.label",
    descriptionKey: "qticaret.features.stock_preorder.description",
  },
  // F4.8: off by default; selling cards and their e-mails come with F9
  [GIFT_CARDS]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.promotions_gift_cards.label",
    descriptionKey: "qticaret.features.promotions_gift_cards.description",
  },
  // F6 (adr/0029): off by default; offered only within the limit, with couriers that collect
  [CASH_ON_DELIVERY]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.payments_cash_on_delivery.label",
    descriptionKey: "qticaret.features.payments_cash_on_delivery.description",
  },
  // F13.4: off until the shop sells something to adults only
  [RESTRICTED_PRODUCTS]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.catalog_restricted.label",
    descriptionKey: "qticaret.features.catalog_restricted.description",
  },
  // F13.3: off by default; on, a cart with a restricted product asks for the buyer's age
  [AGE_VERIFICATION]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.compliance_age_verification.label",
    descriptionKey: "qticaret.features.compliance_age_verification.description",
  },
  // adr/0052: off until the shop sells add-ons; off, carts carrying them do not check out
  [PRODUCT_ADDONS]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.catalog_addons.label",
    descriptionKey: "qticaret.features.catalog_addons.description",
  },
  // adr/0076: dated products are services, so a product is set to one only while
  // catalog.non_physical is on too (the catalog save checks both)
  [CATALOG_BOOKING]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.catalog_booking.label",
    descriptionKey: "qticaret.features.catalog_booking.description",
  },
  // On by default (existing shops unchanged); off hides collections, keeps their records
  [CATALOG_COLLECTIONS]: {
    default: true,
    owner: "tenant",
    labelKey: "qticaret.features.catalog_collections.label",
    descriptionKey: "qticaret.features.catalog_collections.description",
  },
  // adr/0050: off until the shop takes on bulk messages; the panel shows the screen only when on
  [MARKETING_CAMPAIGNS]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.marketing_campaigns.label",
    descriptionKey: "qticaret.features.marketing_campaigns.description",
  },
  // adr/0080: on by default; a pop-up shows only once the shop makes one and switches it on
  [MARKETING_POPUPS]: {
    default: true,
    owner: "tenant",
    labelKey: "qticaret.features.marketing_popups.label",
    descriptionKey: "qticaret.features.marketing_popups.description",
  },
  // adr/0051: off until the shop sells through DMs; off, no link opens and none is made
  [PAYMENT_LINKS]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.orders_payment_links.label",
    descriptionKey: "qticaret.features.orders_payment_links.description",
  },
  // ADR-0068 §9: off until the shop sells wholesale; off, its routes are missing and its
  // price lists are drafts, so wholesalers pay retail until it is on again
  [CUSTOMERS_WHOLESALE]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.customers_wholesale.label",
    descriptionKey: "qticaret.features.customers_wholesale.description",
  },
  // adr/0069 §12: a package's feature, on by default (the storage limit bounds it); off,
  // the video routes are missing and the storefront shows none, records and files stay
  [PRODUCT_VIDEOS]: {
    default: true,
    owner: "platform",
    labelKey: "qticaret.features.catalog_product_videos.label",
    descriptionKey: "qticaret.features.catalog_product_videos.description",
  },
  // adr/0071 §6: a package's feature, on by default; off, AI services can be neither
  // connected nor checked, and stored keys stay but are not used
  [AI_OWN_KEYS]: {
    default: true,
    owner: "platform",
    labelKey: "qticaret.features.ai_own_keys.label",
    descriptionKey: "qticaret.features.ai_own_keys.description",
  },
  // adr/0071 §6, §10: customers' words go to the service, so the shop turns it on itself;
  // off, the review and question tasks are refused and their buttons are not drawn
  [AI_REVIEWS]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.ai_reviews.label",
    descriptionKey: "qticaret.features.ai_reviews.description",
  },
  // adr/0077 §7: the shopper's own words go to the service, so the shop turns it on itself
  // and only its own key pays; off, the interpret route answers as if it did not exist
  [AI_STOREFRONT_SEARCH]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.ai_storefront_search.label",
    descriptionKey: "qticaret.features.ai_storefront_search.description",
  },
  // adr/0079 §8: staff's words go to the service, so only the owner turns it on; off, the
  // assistant's routes answer as if they did not exist
  [AI_ASSISTANT]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.ai_assistant.label",
    descriptionKey: "qticaret.features.ai_assistant.description",
  },
})

/**
 * Flags for tests only, present under NODE_ENV=test (like RATE_LIMIT_RELAXED):
 * the platform has no business flag yet, and the gate must be proven.
 */
const TEST_FEATURES: Readonly<Record<string, FeatureDefinition>> = Object.freeze({
  "test.sample": {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.test_sample.label",
    descriptionKey: "qticaret.features.test_sample.description",
  },
  "test.platform_sample": {
    default: true,
    owner: "platform",
    labelKey: "qticaret.features.test_platform_sample.label",
    descriptionKey: "qticaret.features.test_platform_sample.description",
  },
})

export function featureRegistry(
  env: NodeJS.ProcessEnv = process.env
): Readonly<Record<string, FeatureDefinition>> {
  return env["NODE_ENV"] === "test" ? { ...FEATURES, ...TEST_FEATURES } : FEATURES
}

/** The flag's definition, or undefined; own keys only (`__proto__` is not a flag). */
export function featureDefinition(
  key: string,
  env: NodeJS.ProcessEnv = process.env
): FeatureDefinition | undefined {
  const registry = featureRegistry(env)
  return Object.hasOwn(registry, key) ? registry[key] : undefined
}

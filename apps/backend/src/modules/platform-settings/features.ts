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
 * Content drafts from a model (F10.13, adr/0005): the platform's to turn on,
 * once a provider and its data processing agreement are chosen.
 */
export const CONTENT_AI_DRAFTS = "content.ai_drafts"

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
  // F10.13: off; the shop turns it on, and it works only once the platform has
  // set a provider and its data processing agreement (CONTENT_DRAFT_PROVIDER)
  [CONTENT_AI_DRAFTS]: {
    default: false,
    owner: "tenant",
    labelKey: "qticaret.features.content_ai_drafts.label",
    descriptionKey: "qticaret.features.content_ai_drafts.description",
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

import { includesFolded, wordCount } from "./text"
import type { AdvisorFacts, Rule, SeoIssue } from "./types"

/** Product rules (docs/14 §3.1–§3.5) that today's data can answer; images' alt and size come with F3.3. */

type Product = NonNullable<AdvisorFacts["product"]>

const forProduct =
  (check: (facts: AdvisorFacts, product: Product) => SeoIssue | null): Rule =>
  (facts) =>
    facts.product ? check(facts, facts.product) : null

// docs/14 P-CONT-01: 150 words, 200 suggested
export const MIN_PRODUCT_WORDS = 150
const TARGET_IMAGES = 3

const brandInTitle = forProduct((facts, product) =>
  product.brand && !includesFolded(facts.title, product.brand)
    ? {
        ruleId: "P-TITLE-04",
        severity: "low",
        category: "meta",
        params: { brand: product.brand },
        fix: { kind: "manual", action: "edit_title" },
      }
    : null
)

const contentLength = forProduct((facts) => {
  const count = wordCount(facts.body)
  return count < MIN_PRODUCT_WORDS
    ? {
        ruleId: "P-CONT-01",
        severity: "high",
        category: "content",
        params: { words: count, min: MIN_PRODUCT_WORDS },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
})

const requiredAttributes = forProduct((_facts, product) =>
  product.missingAttributes.length > 0
    ? {
        ruleId: "P-CONT-03",
        severity: "high",
        category: "content",
        params: {
          fields: product.missingAttributes.join(", "),
          count: product.missingAttributes.length,
        },
        fix: { kind: "manual", action: "edit_attributes" },
      }
    : null
)

// The product's name is the page's H1; another in the text competes with it
const headingOrder = forProduct((facts) =>
  /<h1[\s>]/i.test(facts.bodyHtml)
    ? {
        ruleId: "P-CONT-04",
        severity: "medium",
        category: "content",
        params: {},
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
)

const insecureLinks = forProduct((facts) =>
  /\b(?:href|src)\s*=\s*["']?http:\/\//i.test(facts.bodyHtml)
    ? {
        ruleId: "P-CONT-07",
        severity: "medium",
        category: "content",
        params: {},
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
)

// adr/0055 Ek 2026-11-05: a hint, never a block; a sheet's row says nothing of it (left out)
const shortDescription = forProduct((_facts, product) =>
  product.summary === 0
    ? {
        ruleId: "P-CONT-09",
        severity: "info",
        category: "content",
        params: {},
        fix: { kind: "manual", action: "edit_summary" },
      }
    : null
)

const imageCount = forProduct((_facts, product) => {
  if (product.images === 0) {
    return {
      ruleId: "P-IMG-01",
      severity: "critical",
      category: "images",
      params: { count: 0, target: TARGET_IMAGES },
      fix: { kind: "manual", action: "add_images" },
    }
  }
  return product.images < TARGET_IMAGES
    ? {
        ruleId: "P-IMG-01",
        severity: "medium",
        category: "images",
        params: { count: product.images, target: TARGET_IMAGES },
        fix: { kind: "manual", action: "add_images" },
      }
    : null
})

// Screen readers and image search read the alt text; a missing one says nothing
const imageAlt = forProduct((_facts, product) =>
  product.images > 0 && product.imagesWithoutAlt > 0
    ? {
        ruleId: "P-IMG-02",
        severity: "medium",
        category: "images",
        params: { count: product.imagesWithoutAlt, total: product.images },
        fix: { kind: "manual", action: "add_alt_text" },
      }
    : null
)

const prices = forProduct((_facts, product) =>
  product.unpriced > 0
    ? {
        ruleId: "P-DATA-01",
        severity: "critical",
        category: "structured",
        params: { count: product.unpriced },
        fix: { kind: "manual", action: "edit_prices" },
      }
    : null
)

const identifiers = forProduct((_facts, product) =>
  product.unidentified > 0
    ? {
        ruleId: "P-DATA-02",
        severity: "high",
        category: "structured",
        params: { count: product.unidentified, variants: product.variants },
        fix: { kind: "manual", action: "edit_codes" },
      }
    : null
)

const brand = forProduct((_facts, product) =>
  product.brand
    ? null
    : {
        ruleId: "P-DATA-03",
        severity: "medium",
        category: "structured",
        params: {},
        fix: { kind: "manual", action: "edit_brand" },
      }
)

// No category: the product is an orphan; categories but no primary: the panel picks the deepest
const categories = forProduct((_facts, product) => {
  if (product.categories === 0) {
    return {
      ruleId: "P-LINK-01",
      severity: "high",
      category: "links",
      params: {},
      fix: { kind: "manual", action: "edit_categories" },
    }
  }
  return product.primaryCategory
    ? null
    : {
        ruleId: "P-DATA-04",
        severity: "medium",
        category: "technical",
        params: {},
        fix: { kind: "auto", action: "set_primary_category" },
      }
})

// Measures are optional (adr/0054): without them shipping is priced by the
// shop's default parcel, so this is a suggestion, never a blocker
const dimensions = forProduct((_facts, product) =>
  product.physical && product.missingDimensions
    ? {
        ruleId: "P-DATA-05",
        severity: "low",
        category: "technical",
        params: {},
        fix: { kind: "manual", action: "edit_dimensions" },
      }
    : null
)

export const PRODUCT_RULES: readonly Rule[] = [
  brandInTitle,
  contentLength,
  requiredAttributes,
  headingOrder,
  insecureLinks,
  shortDescription,
  imageCount,
  imageAlt,
  prices,
  identifiers,
  brand,
  categories,
  dimensions,
]

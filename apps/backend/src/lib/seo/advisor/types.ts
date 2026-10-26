/**
 * The SEO advisor's vocabulary (docs/14, adr/0005): what a finding says,
 * how much it weighs, and the facts rules read. Rules are pure functions
 * of the facts, so the same page always gets the same score.
 */

export const RULES_VERSION = 1

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const
export type Severity = (typeof SEVERITIES)[number]

/** docs/14 §2: categories and their weights out of 100. */
export const CATEGORY_WEIGHTS = {
  structured: 25,
  meta: 15,
  images: 20,
  content: 20,
  links: 10,
  technical: 10,
} as const
export type Category = keyof typeof CATEGORY_WEIGHTS

export type PageKind = "product" | "category" | "brand" | "collection"

/**
 * How the panel helps: `auto` applies a known change in one click,
 * `suggest` fills a field for the person to check, `manual` takes them to
 * the field. `action` names the change the panel knows how to make.
 */
export interface IssueFix {
  kind: "auto" | "suggest" | "manual"
  action: string
}

export interface SeoIssue {
  ruleId: string
  severity: Severity
  category: Category
  /** Values for the message (`{length}`, `{min}`); the panel holds the words. */
  params: Record<string, string | number>
  fix?: IssueFix
}

/** What the rules read of a page; the caller gathers it (one product, category, brand, collection). */
export interface AdvisorFacts {
  kind: PageKind
  name: string
  handle: string
  /** What a search result shows: the page's own text, else the template's. */
  title: string
  titleIsOwn: boolean
  description: string
  descriptionIsOwn: boolean
  /** The page's text, plain, and as stored (simple HTML). */
  body: string
  bodyHtml: string
  focusKeyword: string | null
  /** Other live, indexable pages of the kind showing the same title or description. */
  duplicates: { title: number; description: number }
  noindex: boolean
  product?:
    | {
        images: number
        variants: number
        /** Variants without a TRY price above zero. */
        unpriced: number
        /** Variants without a valid GTIN nor an MPN with a brand. */
        unidentified: number
        brand: string | null
        categories: number
        primaryCategory: boolean
        physical: boolean
        missingDimensions: boolean
        /** Labels of required attributes left empty (from the shop's template: sector neutral). */
        missingAttributes: string[]
      }
    | undefined
  listing?:
    | {
        /** Published products it lists. */
        products: number
        /** A category's level, the root being 1. */
        depth: number
        hasLogo: boolean
      }
    | undefined
}

export type Rule = (facts: AdvisorFacts) => SeoIssue | null

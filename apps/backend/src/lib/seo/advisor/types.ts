/**
 * The SEO advisor's vocabulary (docs/14, adr/0005): what a finding says,
 * how much it weighs, and the facts rules read. Rules are pure functions
 * of the facts, so the same page always gets the same score.
 */

export const RULES_VERSION = 6

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

export type PageKind = "product" | "category" | "brand" | "collection" | "page" | "post" | "landing"

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
        /** Images with no alt text (docs/13 §8). */
        imagesWithoutAlt: number
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
        /** Characters of its short description's text (adr/0055 Ek 2026-11-06); left out where not known. */
        summary?: number | undefined
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
  /** A content page's or blog post's document, as `lib/content` reads it (F3.16). */
  article?:
    | {
        words: number
        /** Words before the first heading: the opening answer (docs/14 A-ANSWER-01). */
        openingWords: number
        headings: { level: 2 | 3 | 4; text: string }[]
        paragraphs: { sentences: number; words: number }[]
        internalLinks: number
        lists: number
        tables: number
        /** Images in the body and the cover; the ones with no alt text. */
        images: number
        imagesWithoutAlt: number
        author: string | null
        /**
         * The author's record (adr/0060): whether it has a bio. Undefined or
         * null: the name is only the old free text, no author page.
         */
        authorRecord?: { hasBio: boolean } | null
        published: boolean
        /** Days since it last changed in text (or went live); null while a draft. */
        ageDays: number | null
        /** The shop's details the text spells out instead of `{telefon}` and the like (adr/0048). */
        writtenDetails?: string[]
      }
    | undefined
  /** A facet landing page's standing among the others (docs/14 §3.7, F3.16). */
  landing?:
    | {
        words: number
        /** Its own share of text against the other landing pages, 0–100. */
        originality: number
        /** Published products it lists. */
        products: number
        /** Whether it went live in the batch window, and that batch: its size and read share. */
        recent: boolean
        batchSize: number
        batchReviewedShare: number
        reviewed: boolean
      }
    | undefined
}

export type Rule = (facts: AdvisorFacts) => SeoIssue | null

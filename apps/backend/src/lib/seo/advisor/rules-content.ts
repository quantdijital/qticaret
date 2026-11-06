import type { AdvisorFacts, Rule, SeoIssue } from "./types"

/**
 * Content page and blog post rules (docs/14 §3.8). Ids carry `A-`; their
 * names differ from the catalog's (`BYLINE`, not `META`) because the panel
 * words a rule by its name alone, and META-01, LINK-01 and IMG-01 already
 * mean other things.
 */

type Article = NonNullable<AdvisorFacts["article"]>

const forArticle =
  (check: (facts: AdvisorFacts, article: Article) => SeoIssue | null): Rule =>
  (facts) =>
    facts.article ? check(facts, facts.article) : null

export const MIN_ARTICLE_WORDS = 300
// A self-contained answer at the top (docs/14 A-ANSWER-01, docs/13 §9)
export const OPENING_WORDS = { min: 130, max: 170 } as const
// 3–5 links to products or categories per 1,000 words; the floor is 3
const INTERNAL_LINKS_PER_THOUSAND = 3
const MAX_SENTENCES = 4
// Text left unchanged this long gets a "look it over" note
export const STALE_DAYS = 180

const length = forArticle((_facts, article) =>
  article.words < MIN_ARTICLE_WORDS
    ? {
        ruleId: "A-LEN-01",
        severity: "medium",
        category: "content",
        params: { words: article.words, min: MIN_ARTICLE_WORDS },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
)

// A long text needs sections; paragraphs of 2–4 sentences read and quote well
const structure = forArticle((_facts, article) => {
  if (article.words < MIN_ARTICLE_WORDS) {
    return null
  }
  const long = article.paragraphs.filter((p) => p.sentences > MAX_SENTENCES).length
  const problem = !article.headings.some((heading) => heading.level === 2)
    ? "no_headings"
    : long * 3 > article.paragraphs.length
      ? "long_paragraphs"
      : null
  return problem
    ? {
        ruleId: "A-STRUCT-01",
        severity: "medium",
        category: "content",
        params: { problem, long, max: MAX_SENTENCES },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
})

const opening = forArticle((facts, article) =>
  facts.kind === "post" &&
  (article.openingWords < OPENING_WORDS.min || article.openingWords > OPENING_WORDS.max)
    ? {
        ruleId: "A-ANSWER-01",
        severity: "info",
        category: "content",
        params: { words: article.openingWords, ...OPENING_WORDS },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
)

const internalLinks = forArticle((_facts, article) => {
  if (article.words < MIN_ARTICLE_WORDS) {
    return null
  }
  const min = Math.max(1, Math.floor((article.words / 1000) * INTERNAL_LINKS_PER_THOUSAND))
  return article.internalLinks < min
    ? {
        ruleId: "A-INLINK-01",
        severity: "medium",
        category: "links",
        params: { links: article.internalLinks, min },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
})

/**
 * A post names its author, chosen from the shop's authors (adr/0060): none
 * at all weighs more than a name typed before authors had records (no
 * page, no `Person` to link) or an author with no bio (E-E-A-T: who they
 * are and why they write).
 */
const byline = forArticle((facts, article) => {
  if (facts.kind !== "post") {
    return null
  }
  const problem = !article.author
    ? "no_author"
    : !article.authorRecord
      ? "no_author_page"
      : !article.authorRecord.hasBio
        ? "no_bio"
        : null
  return problem
    ? {
        ruleId: "A-BYLINE-01",
        severity: problem === "no_author" ? "medium" : "low",
        category: "meta",
        params: { problem },
        fix: { kind: "manual", action: "edit_author" },
      }
    : null
})

const cover = forArticle((_facts, article) => {
  const problem =
    article.images === 0 ? "no_image" : article.imagesWithoutAlt > 0 ? "missing_alt" : null
  return problem
    ? {
        ruleId: "A-COVER-01",
        severity: "low",
        category: "images",
        params: { problem, count: article.imagesWithoutAlt },
        fix: { kind: "manual", action: "add_image" },
      }
    : null
})

const stale = forArticle((_facts, article) =>
  article.published && article.ageDays !== null && article.ageDays > STALE_DAYS
    ? {
        ruleId: "A-STALE-01",
        severity: "low",
        category: "technical",
        params: { days: article.ageDays, max: STALE_DAYS },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
)

// A phone or e-mail typed into the text goes stale when the store details change (adr/0048)
const writtenDetail = forArticle((_facts, article) =>
  article.writtenDetails?.length
    ? {
        ruleId: "A-DETAIL-01",
        severity: "low",
        category: "content",
        params: { details: article.writtenDetails.join(", ") },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
)

export const CONTENT_RULES: readonly Rule[] = [
  length,
  structure,
  opening,
  internalLinks,
  byline,
  cover,
  stale,
  writtenDetail,
]

import { assess, findIssues } from "../engine"
import type { AdvisorFacts } from "../types"

type Article = NonNullable<AdvisorFacts["article"]>

const ARTICLE: Article = {
  words: 900,
  openingWords: 150,
  headings: [
    { level: 2, text: "Seramik mi porselen mi?" },
    { level: 2, text: "Nasıl temizlenir?" },
  ],
  paragraphs: Array.from({ length: 12 }, () => ({ sentences: 3, words: 60 })),
  internalLinks: 3,
  lists: 1,
  tables: 1,
  images: 2,
  imagesWithoutAlt: 0,
  author: "Ayşe Yılmaz",
  authorRecord: { hasBio: true },
  published: true,
  ageDays: 20,
}

const post = (
  article: Partial<Article> = {},
  overrides: Partial<AdvisorFacts> = {}
): AdvisorFacts => ({
  kind: "post",
  name: "Kupa nasıl seçilir?",
  handle: "kupa-nasil-secilir",
  title: "Kupa Nasıl Seçilir? Seramik ve Porselen | Demo Mağaza",
  titleIsOwn: false,
  description:
    "Seramik mi porselen mi? Günlük kullanım, bulaşık makinesi ve ısı dayanımına göre doğru kupayı seçmeniz için kısa bir rehber.",
  descriptionIsOwn: false,
  body: "metin",
  bodyHtml: "<p>metin</p>",
  focusKeyword: null,
  duplicates: { title: 0, description: 0 },
  noindex: false,
  article: { ...ARTICLE, ...article },
  ...overrides,
})

const ids = (facts: AdvisorFacts) => findIssues(facts).map((issue) => issue.ruleId)

describe("content rules (docs/14 §3.8)", () => {
  it("finds nothing on a complete blog post and scores it 100", () => {
    expect(assess(post())).toMatchObject({ score: 100, grade: "excellent", issues: [] })
  })

  it("asks a short text for more, and judges no structure or links on it", () => {
    expect(ids(post({ words: 120, internalLinks: 0, headings: [] }))).toEqual(["A-LEN-01"])
  })

  it("asks a long text for sections and short paragraphs", () => {
    const [issue] = findIssues(post({ headings: [{ level: 3, text: "Alt başlık" }] }))
    expect(issue).toMatchObject({ ruleId: "A-STRUCT-01", params: { problem: "no_headings" } })
    const long = Array.from({ length: 6 }, (_, index) => ({
      sentences: index < 3 ? 7 : 2,
      words: 80,
    }))
    expect(findIssues(post({ paragraphs: long }))[0]).toMatchObject({
      ruleId: "A-STRUCT-01",
      params: { problem: "long_paragraphs", long: 3 },
    })
  })

  it("wants three links to products or categories per thousand words", () => {
    expect(findIssues(post({ words: 2000, internalLinks: 5 }))[0]).toMatchObject({
      ruleId: "A-INLINK-01",
      params: { links: 5, min: 6 },
    })
  })

  it("asks for {telefon} and the like where the shop's details are typed in (adr/0048)", () => {
    expect(findIssues(post({ writtenDetails: ["telefon", "e_posta"] }))[0]).toMatchObject({
      ruleId: "A-DETAIL-01",
      severity: "low",
      params: { details: "telefon, e_posta" },
    })
    expect(ids(post({ writtenDetails: [] }))).toEqual([])
  })

  it("asks a post, not a page, for its author and its opening answer", () => {
    expect(ids(post({ author: null, openingWords: 40 }))).toEqual(["A-BYLINE-01", "A-ANSWER-01"])
    expect(ids(post({ author: null, openingWords: 40 }, { kind: "page" }))).toEqual([])
    expect(findIssues(post({ author: null, authorRecord: null }))[0]).toMatchObject({
      ruleId: "A-BYLINE-01",
      severity: "medium",
      params: { problem: "no_author" },
    })
  })

  it("asks for an author chosen from the shop's authors, with a bio (adr/0060)", () => {
    expect(findIssues(post({ authorRecord: null }))[0]).toMatchObject({
      ruleId: "A-BYLINE-01",
      severity: "low",
      params: { problem: "no_author_page" },
    })
    expect(findIssues(post({ authorRecord: { hasBio: false } }))[0]).toMatchObject({
      ruleId: "A-BYLINE-01",
      severity: "low",
      params: { problem: "no_bio" },
    })
    expect(ids(post({ authorRecord: { hasBio: true } }))).toEqual([])
  })

  it("notes a page with no image, or images without alt text", () => {
    expect(findIssues(post({ images: 0 }))[0]).toMatchObject({
      ruleId: "A-COVER-01",
      params: { problem: "no_image" },
    })
    expect(findIssues(post({ imagesWithoutAlt: 1 }))[0]).toMatchObject({
      params: { problem: "missing_alt", count: 1 },
    })
  })

  it("asks for a look at a text unchanged for half a year, once live", () => {
    expect(ids(post({ ageDays: 200 }))).toEqual(["A-STALE-01"])
    expect(ids(post({ ageDays: 200, published: false }))).toEqual([])
  })

  it("names shared rules with the content letter", () => {
    expect(ids(post({}, { title: "Kısa" }))).toContain("A-TITLE-01")
  })
})

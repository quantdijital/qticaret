import { assess, findIssues } from "../engine"
import type { AdvisorFacts } from "../types"

type Landing = NonNullable<AdvisorFacts["landing"]>

const STANDING: Landing = {
  words: 450,
  originality: 85,
  products: 12,
  recent: true,
  batchSize: 20,
  batchReviewedShare: 0.1,
  reviewed: false,
}

const landing = (
  standing: Partial<Landing> = {},
  overrides: Partial<AdvisorFacts> = {}
): AdvisorFacts => ({
  kind: "landing",
  name: "Seramik kupalar",
  handle: "seramik",
  title: "Seramik Kupalar: El Yapımı Modeller | Demo Mağaza",
  titleIsOwn: false,
  description:
    "El yapımı seramik kupalar: bulaşık makinesine uygun, ısıyı uzun tutan modeller ve kullanım önerileri tek sayfada.",
  descriptionIsOwn: false,
  body: "metin",
  bodyHtml: "<p>metin</p>",
  focusKeyword: null,
  duplicates: { title: 0, description: 0 },
  noindex: false,
  landing: { ...STANDING, ...standing },
  ...overrides,
})

const ids = (facts: AdvisorFacts) => findIssues(facts).map((issue) => issue.ruleId)

describe("landing page rules (docs/14 §3.7)", () => {
  it("finds nothing on an original, full landing page", () => {
    expect(assess(landing())).toMatchObject({ score: 100, issues: [] })
  })

  it("calls a page under 40% its own critical", () => {
    const [issue] = findIssues(landing({ originality: 35 }))
    expect(issue).toMatchObject({ ruleId: "L-UNIQ-01", severity: "critical" })
    expect(assess(landing({ originality: 35 })).score).toBeLessThan(70)
  })

  it("asks for 300 words and three products, or noindex", () => {
    expect(ids(landing({ words: 120, products: 1 }))).toEqual(["L-PRODUCTS-01", "L-TEXT-01"])
    expect(ids(landing({ products: 1 }, { noindex: true }))).not.toContain("L-PRODUCTS-01")
  })

  it("watches the batch: its size, and the share a person read", () => {
    expect(ids(landing({ batchSize: 140 }))).toEqual(["L-BATCH-01"])
    expect(ids(landing({ batchReviewedShare: 0.02 }))).toEqual(["L-REVIEW-01"])
    expect(ids(landing({ batchReviewedShare: 0.02, reviewed: true }))).toEqual([])
    expect(ids(landing({ batchSize: 140, batchReviewedShare: 0, recent: false }))).toEqual([])
  })
})

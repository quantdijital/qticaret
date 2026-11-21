import {
  SEO_FILL_MAX,
  asksOf,
  fieldsOfScope,
  quotaLeft,
  seoFillCount,
  seoFillKinds,
  seoFillRules,
  seoFillTargets,
  seoFillTasks,
} from "../bulk-seo"

/**
 * Which pages the bulk SEO fill asks for (adr/0074 §5 madde 7): the
 * advisor's findings a search text closes, as a finding's own AI button
 * reads them, on the kinds the tasks are asked for.
 */

const issue = (ruleId: string) => ({ ruleId, severity: "warning", category: "meta", params: {} })

describe("seoFillTasks", () => {
  it("reads the title and description findings, title first, each task once", () => {
    const page = {
      entity_type: "product",
      entity_id: "prod_1",
      issues: [issue("P-META-01"), issue("P-TITLE-03"), issue("P-TITLE-01")],
    }
    expect(seoFillTasks(page, fieldsOfScope("both"))).toEqual(["seo_title", "seo_description"])
    expect(seoFillTasks(page, fieldsOfScope("title"))).toEqual(["seo_title"])
    expect(seoFillTasks(page, fieldsOfScope("description"))).toEqual(["seo_description"])
  })

  it("leaves out findings no search text closes and malformed issues", () => {
    const page = {
      entity_type: "category",
      entity_id: "pcat_1",
      issues: [issue("C-CONT-01"), issue("C-DUP-01"), null, { ruleId: 4 }, "x"],
    }
    expect(seoFillTasks(page, fieldsOfScope("both"))).toEqual([])
    expect(seoFillTasks({ ...page, issues: "nope" }, fieldsOfScope("both"))).toEqual([])
  })

  it("asks nothing for a kind the AI core does not read", () => {
    const landing = { entity_type: "landing", entity_id: "lp_1", issues: [issue("L-TITLE-01")] }
    expect(seoFillTasks(landing, fieldsOfScope("both"))).toEqual([])
  })
})

describe("seoFillKinds", () => {
  it("keeps the kinds the search text tasks are asked for", () => {
    const kinds = seoFillKinds([
      "product",
      "category",
      "brand",
      "collection",
      "page",
      "post",
      "landing",
    ])
    expect(kinds).toEqual(["product", "category", "brand", "collection", "page", "post"])
  })
})

describe("seoFillTargets", () => {
  const pages = [
    { entity_type: "product", entity_id: "prod_1", issues: [issue("P-TITLE-01")] },
    { entity_type: "product", entity_id: "prod_2", issues: [issue("P-CONT-01")] },
    {
      entity_type: "brand",
      entity_id: "brand_1",
      issues: [issue("B-META-01"), issue("B-TITLE-01")],
    },
    // The same page read twice keeps its first place
    { entity_type: "product", entity_id: "prod_1", issues: [issue("P-META-01")] },
  ]

  it("picks the pages with a finding, in the order read, once each", () => {
    expect(seoFillTargets(pages, fieldsOfScope("both"))).toEqual([
      { entity_type: "product", entity_id: "prod_1", tasks: ["seo_title"] },
      { entity_type: "brand", entity_id: "brand_1", tasks: ["seo_title", "seo_description"] },
    ])
  })

  it("leaves out a task already waiting for a decision, and the page when none is left", () => {
    const waiting = new Set(["brand:brand_1:seo_title", "product:prod_1:seo_title"])
    expect(seoFillTargets(pages, fieldsOfScope("both"), waiting)).toEqual([
      { entity_type: "brand", entity_id: "brand_1", tasks: ["seo_description"] },
    ])
  })

  it("is not cut: the caller takes the first SEO_FILL_MAX", () => {
    const many = Array.from({ length: SEO_FILL_MAX + 7 }, (_, i) => ({
      entity_type: "product",
      entity_id: `prod_${String(i)}`,
      issues: [issue("P-META-01")],
    }))
    const targets = seoFillTargets(many, fieldsOfScope("both"))
    expect(targets).toHaveLength(SEO_FILL_MAX + 7)
    expect(asksOf(targets.slice(0, SEO_FILL_MAX))).toBe(SEO_FILL_MAX)
  })
})

describe("quotaLeft", () => {
  it("is the lower of the month's operations and today's text ceiling", () => {
    expect(quotaLeft({ monthly: { used: 90, limit: 100 }, daily: { used: 0, limit: 200 } })).toBe(
      10
    )
    expect(quotaLeft({ monthly: { used: 0, limit: 100 }, daily: { used: 195, limit: 200 } })).toBe(
      5
    )
    expect(quotaLeft({ monthly: { used: 10, limit: null }, daily: { used: 20, limit: 200 } })).toBe(
      180
    )
    expect(quotaLeft({ monthly: { used: 120, limit: 100 }, daily: { used: 0, limit: 200 } })).toBe(
      0
    )
  })
})

describe("seoFillRules", () => {
  it("names the rules a search text closes, by field, as the database filters them", () => {
    expect(seoFillRules(fieldsOfScope("both")).sort()).toEqual(["META-01", "TITLE-01", "TITLE-03"])
    expect(seoFillRules(fieldsOfScope("title")).sort()).toEqual(["TITLE-01", "TITLE-03"])
    expect(seoFillRules(fieldsOfScope("description"))).toEqual(["META-01"])
  })
})

describe("seoFillCount", () => {
  const target = (id: string, tasks: string[]) => ({
    entity_type: "product" as const,
    entity_id: id,
    tasks,
  })

  it("counts pages in all and by field", () => {
    const targets = [
      target("prod_1", ["seo_title"]),
      target("prod_2", ["seo_title", "seo_description"]),
    ]
    expect(seoFillCount(targets, 2)).toEqual({
      pages: 2,
      title: 2,
      description: 1,
      max: SEO_FILL_MAX,
      capped: false,
    })
  })

  it("says capped and stops at the cap once the read went past it", () => {
    const targets = Array.from({ length: 6 }, (_, i) => target(`prod_${String(i)}`, ["seo_title"]))
    expect(seoFillCount(targets, 6, 5)).toMatchObject({ pages: 5, title: 5, capped: true })
    expect(seoFillCount(targets.slice(0, 5), 5, 5)).toMatchObject({ pages: 5, capped: false })
  })
})

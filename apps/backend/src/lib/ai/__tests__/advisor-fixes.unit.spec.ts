import { findIssues } from "../../seo/advisor"
import type { AdvisorFacts, PageKind } from "../../seo/advisor"
import { suggestionProblems } from "../gate"
import {
  ADVISOR_AI_FIELDS,
  ADVISOR_AI_FIXES,
  advisorAiFix,
  withAdvisorAiFixes,
} from "../registry/advisor-fixes"
import { findAiTask, isTaskEntity } from "../registry/tasks"
import type { AiEntityType } from "../facts"

/**
 * The advisor's findings an AI task fixes (docs/22 "Aşama 3"): every entry
 * names a real task for the record, and a suggestion its gate passes,
 * once saved in the field, closes the very finding it was asked for.
 */

const TITLE = "Keten Gömlek Yazlık Model ve Rahat Kesim | Örnek Mağaza"
const DESCRIPTION =
  "Nefes alan keten kumaştan yazlık gömlek. Rahat kesimi ve doğal dokusuyla her gün giyilebilir; ayrıntılar sayfada."
// Plain paragraphs, as the description task answers (adr/0071 §9)
const PARAGRAPH =
  "Keten gömlek nefes alan dokusuyla sıcak günlerde serin tutar ve gün boyu rahat hissettirir. Yıkandıkça yumuşayan kumaşı uzun süre biçimini korur, kırışıklığı doğal bir görünüm katar."
const BODY = Array.from({ length: 6 }, () => PARAGRAPH).join("\n\n")

const facts = (kind: PageKind, overrides: Partial<AdvisorFacts> = {}): AdvisorFacts => ({
  kind,
  name: "Keten Gömlek",
  handle: "keten-gomlek",
  title: TITLE,
  titleIsOwn: true,
  description: DESCRIPTION,
  descriptionIsOwn: true,
  body: BODY,
  bodyHtml: `<p>${BODY}</p>`,
  focusKeyword: null,
  duplicates: { title: 0, description: 0 },
  noindex: false,
  ...overrides,
})

const product = (overrides: Partial<AdvisorFacts> = {}) =>
  facts("product", {
    product: {
      images: 4,
      imagesWithoutAlt: 0,
      variants: 1,
      unpriced: 0,
      unidentified: 0,
      brand: null,
      categories: 1,
      primaryCategory: true,
      physical: false,
      missingDimensions: false,
      missingAttributes: [],
    },
    ...overrides,
  })

const ids = (page: AdvisorFacts) => findIssues(page).map(({ ruleId }) => ruleId)

describe("advisor AI fixes (docs/22 Aşama 3)", () => {
  it("maps each rule to a real task, a known field and one of the task's options", () => {
    for (const fix of Object.values(ADVISOR_AI_FIXES)) {
      const task = findAiTask(fix.task, "production")
      expect(task).not.toBeNull()
      expect(ADVISOR_AI_FIELDS).toContain(fix.field)
      if (fix.option !== undefined) {
        expect(task?.options).toContain(fix.option)
      }
    }
  })

  it("names only rules the advisor raises, on a record the task is asked for", () => {
    const thin = product({
      title: "Gömlek",
      description: "Kısa.",
      body: "Kısa metin.",
      bodyHtml: "<p>Kısa metin.</p>",
    })
    const noisy = product({ title: "KETEN GÖMLEK YAZLIK MODEL RAHAT KESİM ÖRNEK MAĞAZA" })
    const found = [...ids(thin), ...ids(noisy)].map((id) => id.slice(id.indexOf("-") + 1))
    for (const rule of Object.keys(ADVISOR_AI_FIXES)) {
      expect(found).toContain(rule)
    }
    for (const kind of ["product", "category", "page"] as const satisfies AiEntityType[]) {
      const fix = advisorAiFix(kind, { ruleId: "X-TITLE-01" }, "production")
      const task = fix ? findAiTask(fix.task, "production") : null
      expect(task && isTaskEntity(task, kind)).toBe(true)
    }
  })

  it("leaves out what no task fixes: other rules, other kinds, a listing's own text", () => {
    for (const ruleId of ["P-TITLE-02", "P-META-02", "P-TITLE-04", "P-KW-01", "P-IMG-01"]) {
      expect(advisorAiFix("product", { ruleId }, "production")).toBeNull()
    }
    for (const kind of ["brand", "collection", "post", "landing"] as const) {
      expect(advisorAiFix(kind, { ruleId: `X-TITLE-01` }, "production")).toBeNull()
    }
    // A category's CONT-01 is its listing text, not a product's description
    expect(advisorAiFix("category", { ruleId: "C-CONT-01" }, "production")).toBeNull()
    expect(advisorAiFix("product", { ruleId: "P-CONT-01" }, "production")).toEqual({
      task: "product_description",
      field: "description",
      option: "detailed",
    })
  })

  it("adds the fix beside a finding and leaves the others as they were", () => {
    const issues = withAdvisorAiFixes("category", [
      { ruleId: "C-META-01", severity: "medium", category: "meta", params: {} },
      { ruleId: "C-EMPTY-01", severity: "high", category: "content", params: {} },
    ] as const)
    expect(issues[0]?.ai).toEqual({ task: "seo_description", field: "seo_description" })
    expect(issues[1]).not.toHaveProperty("ai")
  })

  it("closes the finding once a suggestion the gate passes is saved in its field", () => {
    const cases: { page: AdvisorFacts; rule: string; saved: Partial<AdvisorFacts> }[] = [
      { page: product({ title: "Gömlek" }), rule: "P-TITLE-01", saved: { title: TITLE } },
      {
        page: facts("category", { title: "MUTFAK MUTFAK MUTFAK ÜRÜNLERİ VE GEREÇLERİ" }),
        rule: "C-TITLE-03",
        saved: { title: TITLE },
      },
      {
        page: facts("page", { description: "Kısa." }),
        rule: "A-META-01",
        saved: { description: DESCRIPTION },
      },
      {
        page: product({ body: "Kısa metin.", bodyHtml: "<p>Kısa metin.</p>" }),
        rule: "P-CONT-01",
        saved: { body: BODY, bodyHtml: `<p>${BODY}</p>` },
      },
    ]
    for (const { page, rule, saved } of cases) {
      const issue = findIssues(page).find(({ ruleId }) => ruleId === rule)
      expect(issue).toBeDefined()
      const fix = issue ? advisorAiFix(page.kind, issue, "production") : null
      const task = fix ? findAiTask(fix.task, "production") : null
      if (!task) {
        throw new Error(`no task for ${rule}`)
      }
      const text = String(saved.title ?? saved.description ?? saved.body)
      expect(suggestionProblems(task, text)).toEqual([])
      expect(ids({ ...page, ...saved })).not.toContain(rule)
    }
  })
})

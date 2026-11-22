import SeoAdvisorModuleService from "../service"
import type { AssessmentInput } from "../service"

const INPUT: AssessmentInput = {
  entity_type: "category",
  entity_id: "pcat_01",
  score: 40,
  grade: "poor",
  issues: [],
  critical: 0,
  rules_version: 1,
  title_hash: null,
  description_hash: null,
  is_listed: true,
}

// What Medusa's dbErrorMapper makes of the unique index (entity_type, entity_id)
const DUPLICATE = new Error(
  "Seo assessment with entity_type: category, entity_id: pcat_01, already exists."
)

function serviceWith(save: jest.Mock) {
  const service = Object.create(SeoAdvisorModuleService.prototype) as SeoAdvisorModuleService
  Object.assign(service, { saveAssessment_: save })
  return service
}

describe("saving an assessment", () => {
  it("updates when another save inserted the page's row first", async () => {
    // The page's save subscriber and the page being opened, at once
    const save = jest.fn().mockRejectedValueOnce(DUPLICATE).mockResolvedValueOnce(undefined)
    await serviceWith(save).saveAssessment(INPUT)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it("leaves other failures alone", async () => {
    const save = jest.fn().mockRejectedValue(new Error("connection lost"))
    await expect(serviceWith(save).saveAssessment(INPUT)).rejects.toThrow("connection lost")
    expect(save).toHaveBeenCalledTimes(1)
  })
})

describe("pages with rules", () => {
  const service = Object.create(SeoAdvisorModuleService.prototype) as SeoAdvisorModuleService
  const managerWith = (rows: unknown[]) => ({ execute: jest.fn().mockResolvedValue(rows) })

  it("filters by kind, rule and limit in the database, every value bound", async () => {
    const manager = managerWith([{ entity_type: "product", entity_id: "prod_1", issues: [] }])
    const rows = await service.pagesWithRules(
      { kinds: ["product", "brand"], rules: ["TITLE-01", "META-01"], limit: 201 },
      { manager }
    )
    expect(rows).toHaveLength(1)
    const [sql, params] = manager.execute.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain("entity_type IN (?, ?)")
    expect(sql).not.toContain("entity_id IN")
    expect(sql).toContain("jsonb_array_elements")
    expect(sql).toMatch(/LIMIT \?$/m)
    expect(sql).not.toMatch(/TITLE|META|product/)
    expect(params).toEqual(["product", "brand", "TITLE-01", "META-01", 201])
  })

  it("narrows to the ids given, and reads nothing for none", async () => {
    const manager = managerWith([])
    await service.pagesWithRules(
      { kinds: ["product"], rules: ["META-01"], limit: 4, ids: ["prod_1", "prod_2"] },
      { manager }
    )
    const [sql, params] = manager.execute.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain("entity_id IN (?, ?)")
    expect(params).toEqual(["product", "prod_1", "prod_2", "META-01", 4])
    expect(
      await service.pagesWithRules(
        { kinds: ["product"], rules: ["META-01"], limit: 4, ids: [] },
        {
          manager,
        }
      )
    ).toEqual([])
    expect(manager.execute).toHaveBeenCalledTimes(1)
  })
})

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

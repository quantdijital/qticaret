import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer } from "@medusajs/framework/utils"
import type * as WorkflowsSdk from "@medusajs/framework/workflows-sdk"
import { AI_MODULE } from "../../../modules/ai"
import { suggestTextWorkflow } from "../suggest-text"

/**
 * A text suggestion's usage row (#195 follow-up): written once, straight
 * after the paid call and before the suggestion, so a failing suggestion
 * step leaves it; the suggestion's id is linked afterwards. The bulk alt
 * text job runs this same workflow for each image.
 */

const mockSteps = {
  call: jest.fn(),
  save: jest.fn(),
  saveUndo: jest.fn(),
}

type Sdk = typeof WorkflowsSdk
function mockSdk(): Sdk {
  return jest.requireActual<Sdk>("@medusajs/framework/workflows-sdk")
}

jest.mock("../steps/authorize-task", () => ({
  authorizeTaskStep: mockSdk().createStep(
    "test-text-authorize",
    () => new (mockSdk().StepResponse)({ task: "seo_title", capability: "text" })
  ),
}))
jest.mock("../steps/select-service", () => ({
  selectServiceStep: mockSdk().createStep(
    "test-text-select",
    () =>
      new (mockSdk().StepResponse)({
        service: "fake",
        funding: "own_key",
        alternatives: [],
        remember: false,
        capability: "text",
        image_file_id: null,
      })
  ),
}))
jest.mock("../steps/task-input", () => ({
  taskInputStep: mockSdk().createStep(
    "test-text-input",
    () =>
      new (mockSdk().StepResponse)({
        system: "instruction",
        data: "record",
        image_file_id: null,
        allowed: null,
      })
  ),
}))
jest.mock("../steps/claim-quota", () => ({
  claimQuotaStep: mockSdk().createStep(
    "test-text-claim",
    () => new (mockSdk().StepResponse)({ group: "text", day: "2026-11-18", month: "2026-11" })
  ),
  releaseUntakenStep: mockSdk().createStep(
    "test-text-release",
    () => new (mockSdk().StepResponse)(true)
  ),
}))
jest.mock("../steps/call-service", () => ({
  callServiceStep: mockSdk().createStep("test-text-call", async () => {
    const outcome: unknown = await mockSteps.call()
    return new (mockSdk().StepResponse)(outcome)
  }),
}))
jest.mock("../steps/save-suggestion", () => ({
  saveSuggestionStep: mockSdk().createStep(
    "test-text-save",
    async () => {
      const id: unknown = await mockSteps.save()
      return new (mockSdk().StepResponse)({ id }, id)
    },
    async (id: unknown) => {
      await mockSteps.saveUndo(id)
    }
  ),
}))

const ai = { recordUsage: jest.fn(), rememberChoice: jest.fn(), updateAiUsages: jest.fn() }

const ANSWERED = {
  status: "succeeded",
  text: "Başlık",
  candidates: ["Başlık"],
  correction: null,
  model: "fake-text",
  input_tokens: 10,
  output_tokens: 5,
  images: null,
  duration_ms: 8,
  error_key: null,
  error_code: null,
  problems: [],
  retry_after_ms: null,
}

const run = () => {
  const container = createMedusaContainer()
  container.register(AI_MODULE, asValue(ai))
  return suggestTextWorkflow(container)
    .run({
      input: { task: "seo_title", entity_type: "product", entity_id: "prod_1", user_id: "user_1" },
      throwOnError: true,
    })
    .then(
      ({ result }) => ({ result, error: null }),
      (error: unknown) => ({ result: null, error })
    )
}

beforeEach(() => {
  jest.resetAllMocks()
  mockSteps.call.mockResolvedValue(ANSWERED)
  mockSteps.save.mockResolvedValue("cdraft_1")
  ai.recordUsage.mockResolvedValue("aiusage_1")
  ai.updateAiUsages.mockResolvedValue({})
})

describe("a text suggestion's usage row", () => {
  it("is written once and then names the suggestion", async () => {
    const { result, error } = await run()
    expect(error).toBeNull()
    expect(result).toMatchObject({ id: "cdraft_1", status: "draft", text: "Başlık" })
    expect(ai.recordUsage).toHaveBeenCalledTimes(1)
    expect(ai.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded", input_tokens: 10, suggestion_id: null })
    )
    expect(ai.updateAiUsages).toHaveBeenCalledTimes(1)
    expect(ai.updateAiUsages).toHaveBeenCalledWith({ id: "aiusage_1", suggestion_id: "cdraft_1" })
  })

  it("stays when saving the suggestion fails after the paid call", async () => {
    mockSteps.save.mockRejectedValue(new Error("database gone"))
    const { error } = await run()
    expect(error).not.toBeNull()
    expect(ai.recordUsage).toHaveBeenCalledTimes(1)
    expect(ai.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded", output_tokens: 5 })
    )
    expect(ai.updateAiUsages).not.toHaveBeenCalled()
  })

  it("is written twice after a correction, the first refused, both naming the suggestion", async () => {
    mockSteps.call.mockResolvedValue({
      ...ANSWERED,
      text: "Aday bir",
      candidates: ["Aday bir", "Aday iki"],
      correction: {
        status: "succeeded",
        input_tokens: 30,
        output_tokens: 7,
        images: null,
        duration_ms: 4,
        error_code: null,
      },
    })
    ai.recordUsage.mockResolvedValueOnce("aiusage_1").mockResolvedValueOnce("aiusage_2")
    const { result, error } = await run()

    expect(error).toBeNull()
    expect(result).toMatchObject({ text: "Aday bir", candidates: ["Aday bir", "Aday iki"] })
    expect(ai.recordUsage).toHaveBeenCalledTimes(2)
    expect(ai.recordUsage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "refused", input_tokens: 10 })
    )
    expect(ai.recordUsage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: "succeeded", input_tokens: 30, duration_ms: 4 })
    )
    expect(ai.updateAiUsages).toHaveBeenCalledWith({ id: "aiusage_1", suggestion_id: "cdraft_1" })
    expect(ai.updateAiUsages).toHaveBeenCalledWith({ id: "aiusage_2", suggestion_id: "cdraft_1" })
  })

  it("is written once for a failed call, which still fails the workflow", async () => {
    mockSteps.call.mockResolvedValue({
      ...ANSWERED,
      status: "failed",
      text: null,
      error_key: "ai.provider_unavailable",
      error_code: "http_503",
    })
    mockSteps.save.mockResolvedValue(null)
    const { error } = await run()
    expect(error).toMatchObject({ safeMessage: "ai.provider_unavailable" })
    expect(ai.recordUsage).toHaveBeenCalledTimes(1)
    expect(ai.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", suggestion_id: null })
    )
    expect(ai.updateAiUsages).not.toHaveBeenCalled()
  })
})

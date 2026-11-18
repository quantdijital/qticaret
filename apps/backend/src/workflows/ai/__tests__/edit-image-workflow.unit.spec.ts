import { asValue } from "@medusajs/framework/awilix"
import type * as WorkflowsSdk from "@medusajs/framework/workflows-sdk"
import { MedusaError, createMedusaContainer } from "@medusajs/framework/utils"
import { AI_MODULE } from "../../../modules/ai"
import { errorKeyOf } from "../bulk-alt-text"
import { editImageWorkflow } from "../edit-image"

/**
 * One picture of a background or scene job (#195 follow-ups): the usage
 * row of a paid call survives a later step's failure and is written once,
 * and the asker's role, the package's flags and the queued service are
 * checked again before any quota is claimed or any call made.
 */

const mockSteps = {
  authorize: jest.fn(),
  select: jest.fn(),
  claim: jest.fn(),
  release: jest.fn(),
  edit: jest.fn(),
  editUndo: jest.fn(),
  keep: jest.fn(),
  keepUndo: jest.fn(),
  save: jest.fn(),
  saveUndo: jest.fn(),
}

type Sdk = typeof WorkflowsSdk
function mockSdk(): Sdk {
  return jest.requireActual<Sdk>("@medusajs/framework/workflows-sdk")
}

jest.mock("../steps/authorize-task", () => ({
  authorizeTaskStep: mockSdk().createStep("test-authorize", async (input: unknown) => {
    await mockSteps.authorize(input)
    return new (mockSdk().StepResponse)({ task: "image_background", capability: "image_edit" })
  }),
}))
jest.mock("../steps/select-service", () => ({
  ...jest.requireActual<object>("../steps/select-service"),
  selectServiceStep: mockSdk().createStep("test-select", async (input: unknown) => {
    const chosen: unknown = await mockSteps.select(input)
    return new (mockSdk().StepResponse)(chosen)
  }),
}))
jest.mock("../steps/claim-quota", () => ({
  claimQuotaStep: mockSdk().createStep("test-claim", async () => {
    await mockSteps.claim()
    return new (mockSdk().StepResponse)({ group: "image", day: "2026-11-18", month: "2026-11" })
  }),
  releaseUntakenStep: mockSdk().createStep("test-release", async () => {
    await mockSteps.release()
    return new (mockSdk().StepResponse)(true)
  }),
}))
jest.mock("../steps/edit-image", () => ({
  editImageStep: mockSdk().createStep(
    "test-edit",
    async (input: unknown) => {
      const outcome: unknown = await mockSteps.edit(input)
      return new (mockSdk().StepResponse)(outcome, "file_1")
    },
    async (file: unknown) => {
      await mockSteps.editUndo(file)
    }
  ),
}))
jest.mock("../steps/keep-edited-image", () => ({
  keepEditedImageStep: mockSdk().createStep(
    "test-keep",
    async (input: { outcome: Record<string, unknown> }) => {
      await mockSteps.keep(input)
      return new (mockSdk().StepResponse)({ ...input.outcome, text: "media_new" }, "media_new")
    },
    async (id: unknown) => {
      await mockSteps.keepUndo(id)
    }
  ),
}))
jest.mock("../steps/save-suggestion", () => ({
  saveSuggestionStep: mockSdk().createStep(
    "test-save",
    async (input: unknown) => {
      const id: unknown = await mockSteps.save(input)
      return new (mockSdk().StepResponse)({ id }, id)
    },
    async (id: unknown) => {
      await mockSteps.saveUndo(id)
    }
  ),
}))

const ai = {
  recordUsage: jest.fn(),
  rememberChoice: jest.fn(),
  updateAiUsages: jest.fn(),
}

const INPUT = {
  task: "image_background",
  service: "fake",
  funding: "own_key" as const,
  background: "white" as const,
  media_id: "media_1",
  user_id: "user_1",
  remember: false,
}

const PAID = {
  status: "succeeded",
  text: null,
  model: "fake-image",
  input_tokens: null,
  output_tokens: null,
  images: 1,
  duration_ms: 12,
  error_key: null,
  error_code: null,
  problems: [],
  retry_after_ms: null,
  file_id: "file_1",
  ai_source: "edited",
}

const run = () => {
  const container = createMedusaContainer()
  container.register(AI_MODULE, asValue(ai))
  return editImageWorkflow(container)
    .run({ input: INPUT, throwOnError: true })
    .then(
      ({ result }) => ({ result, error: null }),
      (error: unknown) => ({ result: null, error })
    )
}

beforeEach(() => {
  jest.resetAllMocks()
  mockSteps.select.mockResolvedValue({
    service: "fake",
    funding: "own_key",
    alternatives: [],
    remember: false,
  })
  mockSteps.edit.mockResolvedValue(PAID)
  mockSteps.save.mockResolvedValue("cdraft_1")
  ai.recordUsage.mockResolvedValue("aiusage_1")
  ai.updateAiUsages.mockResolvedValue({})
})

describe("an edited picture's usage row", () => {
  it("is written once and then names the suggestion", async () => {
    const { result, error } = await run()
    expect(error).toBeNull()
    expect(result).toMatchObject({ status: "succeeded", media_id: "media_new" })
    expect(ai.recordUsage).toHaveBeenCalledTimes(1)
    expect(ai.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "image_background",
        capability: "image_edit",
        service: "fake",
        status: "succeeded",
        images: 1,
        suggestion_id: null,
        requested_by: "user_1",
      })
    )
    expect(ai.updateAiUsages).toHaveBeenCalledWith({ id: "aiusage_1", suggestion_id: "cdraft_1" })
  })

  it("stays when saving the suggestion fails after the paid call", async () => {
    mockSteps.save.mockRejectedValue(new Error("database gone"))
    const { error } = await run()
    expect(error).not.toBeNull()
    expect(ai.recordUsage).toHaveBeenCalledTimes(1)
    expect(ai.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded", images: 1 })
    )
    // The kept record and the file go; the row has no undo to run
    expect(mockSteps.keepUndo).toHaveBeenCalledWith("media_new")
    expect(mockSteps.editUndo).toHaveBeenCalledWith("file_1")
    expect(ai.updateAiUsages).not.toHaveBeenCalled()
  })

  it("stays, written once, when linking the suggestion fails", async () => {
    ai.updateAiUsages.mockRejectedValue(new Error("database gone"))
    const { error } = await run()
    expect(error).not.toBeNull()
    expect(ai.recordUsage).toHaveBeenCalledTimes(1)
    expect(mockSteps.saveUndo).toHaveBeenCalledWith("cdraft_1")
  })

  it("is written for a failed call too, with nothing to link", async () => {
    mockSteps.edit.mockResolvedValue({
      ...PAID,
      status: "failed",
      images: null,
      file_id: null,
      error_key: "ai.provider_unavailable",
      error_code: "http_503",
    })
    mockSteps.save.mockResolvedValue(null)
    const { result } = await run()
    expect(result).toMatchObject({ status: "failed", error_key: "ai.provider_unavailable" })
    expect(ai.recordUsage).toHaveBeenCalledTimes(1)
    expect(ai.updateAiUsages).not.toHaveBeenCalled()
  })
})

describe("before each picture", () => {
  it("checks the asker's role, the option and the queued service", async () => {
    await run()
    expect(mockSteps.authorize).toHaveBeenCalledWith({
      task: "image_background",
      option: "white",
      user_id: "user_1",
    })
    expect(mockSteps.select).toHaveBeenCalledWith({
      task: "image_background",
      user_id: "user_1",
      service: "fake",
    })
  })

  it.each([
    ["a lowered role", new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")],
    ["ai.own_keys closed", new MedusaError(MedusaError.Types.FORBIDDEN, "ai.own_keys_not_in_plan")],
  ])("stops on %s before any quota or call", async (_, refusal) => {
    mockSteps.authorize.mockRejectedValue(refusal)
    const { error } = await run()
    expect(error).toMatchObject({ message: refusal.message })
    expect(mockSteps.claim).not.toHaveBeenCalled()
    expect(mockSteps.edit).not.toHaveBeenCalled()
    expect(ai.recordUsage).not.toHaveBeenCalled()
  })

  it.each([
    ["another service", { service: "openai", funding: "own_key" }],
    ["the same service paid another way", { service: "fake", funding: "platform_credit" }],
  ])("stops when the choice now is %s", async (_, chosen) => {
    mockSteps.select.mockResolvedValue({ ...chosen, alternatives: [], remember: false })
    const { error } = await run()
    // As the job reads it (`errorKeyOf`): the workflow hands its error back as a plain shape
    expect(errorKeyOf(error)).toBe("ai.service_unavailable")
    expect(error).toMatchObject({ safeMessage: "ai.service_unavailable" })
    expect(mockSteps.claim).not.toHaveBeenCalled()
    expect(mockSteps.edit).not.toHaveBeenCalled()
  })
})

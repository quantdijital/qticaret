import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer } from "@medusajs/framework/utils"
import type * as WorkflowsSdk from "@medusajs/framework/workflows-sdk"
import { AI_MODULE } from "../../../modules/ai"
import { assistantTurnWorkflow } from "../assistant-turn"

/**
 * Security review D3 (#321): an assistant turn's `ai_usage` rows are
 * written before the conversation is kept, so Redis failing the save
 * never loses the record of a paid model call.
 */

const mockSave = jest.fn()

type Sdk = typeof WorkflowsSdk
function mockSdk(): Sdk {
  return jest.requireActual<Sdk>("@medusajs/framework/workflows-sdk")
}

jest.mock("../steps/assistant-turn", () => ({
  assistantAccessStep: mockSdk().createStep(
    "test-assistant-access",
    () =>
      new (mockSdk().StepResponse)({
        role: "owner",
        service: "fake",
        funding: "own_key",
        features: [],
      })
  ),
  assistantRunStep: mockSdk().createStep(
    "test-assistant-run",
    () =>
      new (mockSdk().StepResponse)({
        conversation_id: "aiconv_00000000000000000000000000000001",
        record: { user_id: "user_1", created_at: 0, updated_at: 0, messages: [] },
        reply: { text: "Tamam", screens: [] },
        user_text: "kargo",
        error: null,
        model: "fake-tools",
        calls: [
          {
            status: "succeeded",
            input_tokens: 12,
            output_tokens: 4,
            duration_ms: 5,
            error_code: null,
          },
        ],
        tool_counts: { find_screen: 1 },
      })
  ),
  assistantSaveStep: mockSdk().createStep("test-assistant-save", async () => {
    await mockSave()
    return new (mockSdk().StepResponse)(true)
  }),
}))

const ai = { recordUsage: jest.fn() }

const run = () => {
  const container = createMedusaContainer()
  container.register(AI_MODULE, asValue(ai))
  return assistantTurnWorkflow(container)
    .run({ input: { user_id: "user_1", message: "kargo" }, throwOnError: true })
    .then(
      ({ result }) => ({ result, error: null }),
      (error: unknown) => ({ result: null, error })
    )
}

beforeEach(() => {
  jest.resetAllMocks()
  ai.recordUsage.mockResolvedValue("aiusage_1")
  mockSave.mockResolvedValue(undefined)
})

describe("an assistant turn's usage rows", () => {
  it("are written before the conversation is kept", async () => {
    const order: string[] = []
    ai.recordUsage.mockImplementation(() => {
      order.push("record")
      return Promise.resolve("aiusage_1")
    })
    mockSave.mockImplementation(() => {
      order.push("save")
      return Promise.resolve()
    })

    const { error } = await run()

    expect(error).toBeNull()
    expect(order).toEqual(["record", "save"])
  })

  it("stay when Redis fails the save", async () => {
    mockSave.mockRejectedValue(new Error("redis down"))

    const { error } = await run()

    expect(error).not.toBeNull()
    expect(ai.recordUsage).toHaveBeenCalledTimes(1)
    expect(ai.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "assistant",
        status: "succeeded",
        input_tokens: 12,
        entity_id: "find_screen:1",
        requested_by: "user_1",
      })
    )
  })
})

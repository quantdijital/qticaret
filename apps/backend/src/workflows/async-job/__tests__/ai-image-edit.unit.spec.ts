import { MedusaError } from "@medusajs/framework/utils"
import { PlanLimitError, ValidationError } from "../../../lib/errors"
import { aiImageEdit } from "../types/ai-image-edit"
import type { JobContext } from "../types"

/**
 * `ai.image_edit` (Aşama 4, adr/0071 §8): identifiers only, at most the
 * task's batch; each picture its own run (its own claim and usage row);
 * the rest skipped once the quota or the storage runs out.
 */

jest.mock("../../../lib/plan-limits", () => ({ assertStorageFits: jest.fn() }))
const run = jest.fn()
jest.mock("../../ai/edit-image", () => ({
  editImageWorkflow: () => ({ run }),
}))
const { assertStorageFits } = jest.requireMock<{ assertStorageFits: jest.Mock }>(
  "../../../lib/plan-limits"
)

const ids = (count: number) => Array.from({ length: count }, (_, i) => `media_${String(i)}`)
const INPUT = {
  task: "image_background",
  service: "fake",
  funding: "own_key",
  background: "white",
  media_ids: ids(3),
  remember: true,
}

const SCENE = {
  task: "image_scene",
  service: "fake",
  funding: "own_key",
  scene: "studio_table",
  media_ids: ["media_1"],
  remember: true,
}

const context = (requestedBy: string | null = "user_1") =>
  ({
    container: {},
    job: { id: "job_1", requested_by: requestedBy },
    progress: jest.fn(() => Promise.resolve()),
    resultFile: jest.fn(),
  }) as unknown as JobContext

const succeeded = (mediaId: string) => ({
  result: {
    status: "succeeded",
    error_key: null,
    error_code: null,
    media_id: `${mediaId}_ai`,
    suggestion_id: `cdraft_${mediaId}`,
  },
})

beforeEach(() => {
  jest.clearAllMocks()
  assertStorageFits.mockResolvedValue(undefined)
  run.mockImplementation(({ input }: { input: { media_id: string } }) =>
    Promise.resolve(succeeded(input.media_id))
  )
})

describe("the background job's input", () => {
  it("takes one to twenty distinct pictures and nothing else", () => {
    expect(aiImageEdit.input.safeParse(INPUT).success).toBe(true)
    expect(aiImageEdit.input.safeParse({ ...INPUT, media_ids: ids(20) }).success).toBe(true)
    for (const bad of [
      { ...INPUT, media_ids: ids(21) },
      { ...INPUT, media_ids: [] },
      { ...INPUT, media_ids: ["media_1", "media_1"] },
      { ...INPUT, media_ids: ["prod_1"] },
      { ...INPUT, background: "blue" },
      { ...INPUT, task: "seo_title" },
      // Who asked is the job's own, never the input's
      { ...INPUT, user_id: "user_2" },
      { ...INPUT, price: 1 },
    ]) {
      expect(aiImageEdit.input.safeParse(bad).success).toBe(false)
    }
  })

  it("takes a scene by its code, one picture, and never a prompt or a background", () => {
    expect(aiImageEdit.input.safeParse(SCENE).success).toBe(true)
    for (const bad of [
      { ...SCENE, media_ids: ids(2) },
      { ...SCENE, scene: "Studio Table" },
      { ...SCENE, scene: undefined },
      { ...SCENE, prompt: "a table" },
      { ...SCENE, background: "white" },
    ]) {
      expect(aiImageEdit.input.safeParse(bad).success).toBe(false)
    }
  })

  it("passes the scene on to each picture's run and says it in the summary", async () => {
    const { summary } = await aiImageEdit.execute(context(), aiImageEdit.input.parse(SCENE))
    const calls = run.mock.calls as [{ input: Record<string, unknown> }][]
    expect(calls[0]?.[0].input).toMatchObject({ task: "image_scene", scene: "studio_table" })
    expect(calls[0]?.[0].input).not.toHaveProperty("background")
    expect(summary).toMatchObject({ task: "image_scene", scene: "studio_table" })
  })
})

describe("running the background job", () => {
  it("runs each picture on its own, as the job's asker, remembering the service once", async () => {
    const { summary } = await aiImageEdit.execute(context(), aiImageEdit.input.parse(INPUT))
    expect(run).toHaveBeenCalledTimes(3)
    const calls = run.mock.calls as [{ input: Record<string, unknown> }][]
    const inputs = calls.map(([call]) => call.input)
    expect(inputs.map((each) => each["media_id"])).toEqual(ids(3))
    expect(inputs.every((each) => each["user_id"] === "user_1")).toBe(true)
    expect(inputs.map((each) => each["remember"])).toEqual([true, false, false])
    expect(summary).toMatchObject({
      done: ids(3).map((id) => ({ media_id: id, result_id: `${id}_ai` })),
      failed: [],
      skipped: 0,
      stopped_by: null,
    })
  })

  it("skips the rest once the day's limit is reached", async () => {
    run
      .mockImplementationOnce(() => Promise.resolve(succeeded("media_0")))
      .mockImplementationOnce(() => Promise.reject(new ValidationError("ai.daily_limit_reached")))
    const { summary } = await aiImageEdit.execute(context(), aiImageEdit.input.parse(INPUT))
    expect(run).toHaveBeenCalledTimes(2)
    expect(summary).toMatchObject({ failed: [], skipped: 2, stopped_by: "ai.daily_limit_reached" })
  })

  it("stops before a call once the storage is full", async () => {
    assertStorageFits
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new PlanLimitError("storage_mb", 10, 10))
    const { summary } = await aiImageEdit.execute(context(), aiImageEdit.input.parse(INPUT))
    expect(run).toHaveBeenCalledTimes(1)
    expect(summary).toMatchObject({ skipped: 2, stopped_by: "plan.limit_reached" })
  })

  it("goes on past one picture's failure, saying only our key", async () => {
    run.mockImplementationOnce(() =>
      Promise.resolve({
        result: {
          status: "failed",
          error_key: "ai.content_blocked",
          error_code: "finish_blocked",
          media_id: null,
          suggestion_id: null,
        },
      })
    )
    const { summary } = await aiImageEdit.execute(context(), aiImageEdit.input.parse(INPUT))
    expect(summary).toMatchObject({
      failed: [{ media_id: "media_0", key: "ai.content_blocked" }],
      skipped: 0,
    })
    expect((summary["done"] as unknown[]).length).toBe(2)
  })

  it.each([
    [
      "the asker's role was lowered",
      new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden"),
    ],
    [
      "ai.own_keys was closed",
      new MedusaError(MedusaError.Types.FORBIDDEN, "ai.own_keys_not_in_plan"),
    ],
    ["the queued service is gone", new ValidationError("ai.service_unavailable")],
    ["no service is left", new ValidationError("ai.no_service")],
  ])("stops before the next picture once %s", async (_, refusal) => {
    run
      .mockImplementationOnce(() => Promise.resolve(succeeded("media_0")))
      .mockImplementationOnce(() => Promise.reject(refusal))
    const { summary } = await aiImageEdit.execute(context(), aiImageEdit.input.parse(INPUT))
    expect(run).toHaveBeenCalledTimes(2)
    expect(summary).toMatchObject({
      failed: [],
      skipped: 2,
      stopped_by: (refusal as { safeMessage?: string }).safeMessage ?? refusal.message,
    })
    expect((summary["done"] as unknown[]).length).toBe(1)
  })

  it("goes on past an error that holds for one picture only", async () => {
    run.mockImplementationOnce(() => Promise.reject(new ValidationError("ai.unknown_entity")))
    const { summary } = await aiImageEdit.execute(context(), aiImageEdit.input.parse(INPUT))
    expect(run).toHaveBeenCalledTimes(3)
    expect(summary).toMatchObject({ skipped: 0, stopped_by: null })
  })

  it("refuses a job nobody queued", async () => {
    await expect(
      aiImageEdit.execute(context(null), aiImageEdit.input.parse(INPUT))
    ).rejects.toThrow()
    expect(run).not.toHaveBeenCalled()
  })
})

import { aiProviderError } from "../../../../lib/ai/errors"
import { AI_MODULE } from "../../../../modules/ai"
import { correctionClaim, correctionUsageOf } from "../correction-claim"

/**
 * adr/0074 §4: the correction call takes a place under the day's ceiling
 * only (never the month's AI operations, which the ask took once), and
 * gives it back when the service never took the job.
 */

// The day's ceilings in force, as the platform set them
jest.mock("../claim-quota", () => ({
  dailyLimitsInForce: () => ({ text: 400, image: 100, video: 10 }),
}))

const ai = { claimDaily: jest.fn(), releaseDaily: jest.fn() }
const container = {
  resolve: (key: string) => {
    if (key !== AI_MODULE) {
      throw new Error(`no ${key} here: the month's quota is not touched`)
    }
    return ai
  },
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe("the correction's claim", () => {
  it("claims the day's ceiling of its kind, and allows no correction when it is full", async () => {
    ai.claimDaily.mockResolvedValueOnce("2026-11-20").mockResolvedValueOnce(null)
    expect(await correctionClaim(container, "text").mayCorrect()).toBe(true)
    expect(await correctionClaim(container, "image_edit").mayCorrect()).toBe(false)
    expect(ai.claimDaily).toHaveBeenNthCalledWith(1, "text", 400)
    expect(ai.claimDaily).toHaveBeenNthCalledWith(2, "image", 100)
  })

  it("gives the place back only when the service never took the correction", async () => {
    ai.claimDaily.mockResolvedValue("2026-11-20")
    const busy = aiProviderError({ service: "fake", key: "ai.provider_busy", code: "http_429" })
    const late = aiProviderError({ service: "fake", key: "ai.timeout", code: "timeout" })

    const untaken = correctionClaim(container, "text")
    await untaken.mayCorrect()
    await untaken.settle({ status: "failed", error: busy, duration_ms: 3 })
    expect(ai.releaseDaily).toHaveBeenCalledWith("text", "2026-11-20")

    ai.releaseDaily.mockClear()
    const taken = correctionClaim(container, "text")
    await taken.mayCorrect()
    await taken.settle({ status: "failed", error: late, duration_ms: 3 })
    await taken.settle(null)
    expect(ai.releaseDaily).not.toHaveBeenCalled()

    // Never claimed: nothing to give back
    await correctionClaim(container, "text").settle({
      status: "failed",
      error: busy,
      duration_ms: 1,
    })
    expect(ai.releaseDaily).not.toHaveBeenCalled()
  })

  it("writes the correction's own usage row", () => {
    const busy = aiProviderError({ service: "fake", key: "ai.provider_busy", code: "http_429" })
    expect(correctionUsageOf(null, null)).toBeNull()
    expect(correctionUsageOf({ status: "failed", error: busy, duration_ms: 5 }, 1)).toEqual({
      status: "failed",
      input_tokens: null,
      output_tokens: null,
      images: 1,
      duration_ms: 5,
      error_code: "http_429",
    })
    expect(
      correctionUsageOf(
        {
          status: "answered",
          attempt: {
            status: "refused",
            problems: ["length"],
            usage: { inputTokens: 9, outputTokens: 2 },
            duration_ms: 6,
          },
        },
        null
      )
    ).toEqual({
      status: "refused",
      input_tokens: 9,
      output_tokens: 2,
      images: null,
      duration_ms: 6,
      error_code: null,
    })
  })
})

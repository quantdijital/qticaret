import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer } from "@medusajs/framework/utils"
import { AI_MODULE } from "../../../../modules/ai"
import { CONTENT_DRAFTS_MODULE } from "../../../../modules/content-drafts"
import { claimAssistantCall, releaseAssistantCall } from "../assistant-claims"
import { claimQuota, releaseIfUntaken } from "../claim-quota"

/**
 * adr/0085 K9 (P4b-1): a call on the platform's credits takes no place
 * in the month's operations (`llm_credits_per_month`, the credits bound
 * it) and gives none back; the day's ceilings hold the same. The shop's
 * own key: as before, the day and the month.
 */

jest.mock("../../../../lib/env", () => ({
  ...jest.requireActual<object>("../../../../lib/env"),
  parseEnv: () => ({}),
}))
jest.mock("../../../../lib/plan-limits", () => ({
  draftQuotaOf: () => Promise.resolve({ quota: 100, plan: 100 }),
  forgetUsage: jest.fn(),
}))

const ai = {
  claimDaily: jest.fn(),
  releaseDaily: jest.fn(),
}
const drafts = {
  claimQuota: jest.fn(),
  releaseQuota: jest.fn(),
  usedThisMonth: jest.fn(),
}

function shop() {
  const made = createMedusaContainer()
  made.register({
    [AI_MODULE]: asValue(ai),
    [CONTENT_DRAFTS_MODULE]: asValue(drafts),
  })
  return made
}

const NOW = new Date("2026-11-25T10:00:00Z")
const UNTAKEN = {
  error_key: "ai.credits_exhausted",
  error_code: "gateway_credits_exhausted",
} as const

beforeEach(() => {
  ai.claimDaily.mockReset().mockResolvedValue("2026-11-25")
  ai.releaseDaily.mockReset().mockResolvedValue(undefined)
  drafts.claimQuota.mockReset().mockResolvedValue(true)
  drafts.releaseQuota.mockReset().mockResolvedValue(undefined)
})

describe("the quota of a call", () => {
  it("on credits claims the day only, and gives back the day only", async () => {
    const claimed = await claimQuota(
      shop(),
      { capability: "text", funding: "platform_credit" },
      NOW
    )
    expect(claimed).toMatchObject({ group: "text", monthly: false })
    expect(ai.claimDaily).toHaveBeenCalledTimes(1)
    expect(drafts.claimQuota).not.toHaveBeenCalled()

    expect(await releaseIfUntaken(shop(), claimed, UNTAKEN)).toBe(true)
    expect(ai.releaseDaily).toHaveBeenCalledTimes(1)
    expect(drafts.releaseQuota).not.toHaveBeenCalled()
  })

  it("on credits is still held to the day's ceiling", async () => {
    ai.claimDaily.mockResolvedValue(null)
    await expect(
      claimQuota(shop(), { capability: "text", funding: "platform_credit" }, NOW)
    ).rejects.toThrow("ai.daily_limit_reached")
  })

  it("on the shop's own key claims and gives back the day and the month, as before", async () => {
    const claimed = await claimQuota(shop(), { capability: "text", funding: "own_key" }, NOW)
    expect(claimed.monthly).toBeUndefined()
    expect(drafts.claimQuota).toHaveBeenCalledTimes(1)

    const untaken = { error_key: "ai.provider_busy", error_code: "http_429" } as const
    expect(await releaseIfUntaken(shop(), claimed, untaken)).toBe(true)
    expect(drafts.releaseQuota).toHaveBeenCalledWith("2026-11")
  })

  it("keeps a call the service took, either way", async () => {
    const claimed = await claimQuota(
      shop(),
      { capability: "text", funding: "platform_credit" },
      NOW
    )
    const taken = { error_key: "ai.timeout", error_code: "timeout" } as const
    expect(await releaseIfUntaken(shop(), claimed, taken)).toBe(false)
    expect(ai.releaseDaily).not.toHaveBeenCalled()
  })
})

describe("the assistant's model call", () => {
  it("on credits claims the shop's and the person's day, not the month", async () => {
    const claimed = await claimAssistantCall(shop(), "user_1", NOW, false)
    expect(claimed).toEqual({
      ok: true,
      claim: { day: "2026-11-25", user_day: "2026-11-25", month: null },
    })
    expect(ai.claimDaily).toHaveBeenCalledTimes(2)
    expect(drafts.claimQuota).not.toHaveBeenCalled()
    if (claimed.ok) {
      await releaseAssistantCall(shop(), "user_1", claimed.claim)
    }
    expect(ai.releaseDaily).toHaveBeenCalledTimes(2)
    expect(drafts.releaseQuota).not.toHaveBeenCalled()
  })

  it("on the shop's own key claims the month too, as before", async () => {
    const claimed = await claimAssistantCall(shop(), "user_1", NOW)
    expect(claimed).toMatchObject({ ok: true, claim: { month: "2026-11" } })
    expect(drafts.claimQuota).toHaveBeenCalledTimes(1)
  })
})

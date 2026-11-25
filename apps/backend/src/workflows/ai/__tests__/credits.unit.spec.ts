import { aiCreditPackSchema } from "@qticaret/types/control-plane"
import type { AiCreditPack, AiCreditsStatus } from "@qticaret/types/control-plane"
import { AdminPostAiCreditOrder } from "../../../api/admin/ai/validators"
import { requestAiCreditOrder } from "../../../lib/control-plane/ai-credit-order"
import { aiCreditsStatus, forgetAiCreditsStatus } from "../../../lib/control-plane/ai-credits"
import { aiGatewayEndpoint } from "../../../lib/control-plane/ai-gateway"
import { aiCreditsView, aiCreditsViewSchema, creditsViewOf } from "../credits-view"
import { requestCreditOrder } from "../steps/request-credit-order"

jest.mock("../../../lib/control-plane/ai-credits", () => ({
  aiCreditsStatus: jest.fn(),
  forgetAiCreditsStatus: jest.fn(),
}))
jest.mock("../../../lib/control-plane/ai-gateway", () => ({ aiGatewayEndpoint: jest.fn() }))
jest.mock("../../../lib/control-plane/ai-credit-order", () => ({ requestAiCreditOrder: jest.fn() }))

const status = jest.mocked(aiCreditsStatus)
const endpoint = jest.mocked(aiGatewayEndpoint)
const order = jest.mocked(requestAiCreditOrder)
const forget = jest.mocked(forgetAiCreditsStatus)

/** adr/0085 §3, K11 (P4b-2): the panel's view of the credits and its top-up request. */

const PACK: AiCreditPack = {
  id: "pack-500",
  name: "500 kredi",
  credits: 500,
  amount: 25_000,
  currency: "TRY",
}
const OPEN = {
  id: "aicord_01",
  pack: PACK,
  status: "pending",
  requested_at: "2026-11-25T10:00:00.000Z",
} as const

const AVAILABLE: AiCreditsStatus = {
  available: true,
  balance: {
    plan: { remaining: 30, renews_on: "2026-12-01" },
    purchased: { remaining: 100, expires_on: "2027-11-01" },
  },
  daily: { cap: 300, remaining: 280 },
  services: { text: "deepseek", image_edit: "photoroom" },
  // A task this shop does not know (the gateway's table may be newer) is left out
  table: { seo_title: 1, image_scene: 40, video_teaser: 90 },
  packs: [PACK],
  pending_order: OPEN,
}

const shopWith = (flag: boolean) => ({
  resolve: () => ({ isFeatureEnabled: () => Promise.resolve(flag) }),
})

beforeEach(() => {
  jest.resetAllMocks()
  endpoint.mockReturnValue({ url: "http://cp", tenantId: "t", signer: {} as never })
  status.mockResolvedValue(AVAILABLE)
})

describe("the credits' view", () => {
  it("names each field it gives and never the routing", () => {
    const view = creditsViewOf(AVAILABLE)
    expect(view).toEqual({
      available: true,
      plan: { remaining: 30, renews_on: "2026-12-01" },
      purchased: { remaining: 100, expires_on: "2027-11-01" },
      daily: { cap: 300, remaining: 280 },
      tasks: { seo_title: 1, image_scene: 40 },
      packs: [PACK],
      pending_order: {
        id: "aicord_01",
        pack_id: "pack-500",
        credits: 500,
        amount: 25_000,
        currency: "TRY",
        status: "pending",
        requested_at: "2026-11-25T10:00:00.000Z",
      },
    })
    const text = JSON.stringify(view)
    for (const hidden of ["services", "deepseek", "photoroom", "video_teaser"]) {
      expect(text).not.toContain(hidden)
    }
  })

  it("holds the answer to a closed schema", () => {
    const view = creditsViewOf(AVAILABLE)
    expect(aiCreditsViewSchema.safeParse({ ...view, services: { text: "x" } }).success).toBe(false)
    expect(aiCreditsViewSchema.safeParse({ available: false, plan: {} }).success).toBe(false)
  })

  it("says only unavailable, asking nobody, with the flag off or unmanaged", async () => {
    await expect(aiCreditsView(shopWith(false))).resolves.toEqual({ available: false })
    endpoint.mockReturnValue(null)
    await expect(aiCreditsView(shopWith(true))).resolves.toEqual({ available: false })
    expect(status).not.toHaveBeenCalled()
    status.mockResolvedValue({ available: false })
    endpoint.mockReturnValue({ url: "http://cp", tenantId: "t", signer: {} as never })
    await expect(aiCreditsView(shopWith(true))).resolves.toEqual({ available: false })
  })
})

describe("a top-up request", () => {
  it("takes the pack's id alone, as the control plane's pack id", () => {
    expect(AdminPostAiCreditOrder.safeParse({ pack_id: "pack-500" }).success).toBe(true)
    for (const extra of [
      { amount: 1 },
      { credits: 1000 },
      { currency: "TRY" },
      { requested_by: "u" },
    ]) {
      expect(AdminPostAiCreditOrder.safeParse({ pack_id: "pack-500", ...extra }).success).toBe(
        false
      )
    }
    for (const id of ["pack-500", "a", "x".repeat(40), "x".repeat(41), "Pack", "-a", "a b", ""]) {
      expect(AdminPostAiCreditOrder.safeParse({ pack_id: id }).success).toBe(
        aiCreditPackSchema.shape.id.safeParse(id).success
      )
    }
  })

  it("returns the order narrowed and forgets the kept status", async () => {
    order.mockResolvedValue({ kind: "ordered", order: OPEN })
    await expect(
      requestCreditOrder(shopWith(true), { pack_id: "pack-500", user_id: "user_1" })
    ).resolves.toEqual({
      id: "aicord_01",
      pack_id: "pack-500",
      credits: 500,
      amount: 25_000,
      currency: "TRY",
      status: "pending",
      requested_at: "2026-11-25T10:00:00.000Z",
    })
    expect(order).toHaveBeenCalledWith({ packId: "pack-500", requestedBy: "user_1" }, {})
    expect(forget).toHaveBeenCalledTimes(1)
  })

  it.each([
    [{ kind: "open" }, "ai.credits_order_open", "ConflictError"],
    [{ kind: "pack_unknown" }, "ai.credits_pack_unknown", "ConflictError"],
    [{ kind: "unavailable", code: "http_500" }, "ai.platform_unavailable", "ProviderError"],
  ] as const)("tells %j as %s", async (result, key, name) => {
    order.mockResolvedValue(result)
    const failed = requestCreditOrder(shopWith(true), { pack_id: "pack-500", user_id: "user_1" })
    await expect(failed).rejects.toMatchObject({ safeMessage: key, name })
    expect(forget).not.toHaveBeenCalled()
  })

  it("sends nothing with the flag off", async () => {
    await expect(
      requestCreditOrder(shopWith(false), { pack_id: "pack-500", user_id: "user_1" })
    ).rejects.toMatchObject({ safeMessage: "ai.platform_unavailable" })
    expect(order).not.toHaveBeenCalled()
  })
})

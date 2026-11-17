import { planDocumentSchema } from "@qticaret/types/control-plane"
import { fullLimits } from "../../plans/limits"
import {
  NEUTRAL_BILLING,
  contentHash,
  effectiveFlags,
  planContent,
  planDocumentOf,
} from "../plan-content"
import type { PlanContentInput } from "../plan-content"

const NOW = new Date("2026-11-11T09:00:00Z")
const FLAG = "test.platform_sample"
// adr/0069: the first business flag, on by default
const VIDEOS = "catalog.product_videos"
// adr/0071 §6: AI with the shop's own key, on by default
const AI_OWN_KEYS = "ai.own_keys"

const input = (changes: Partial<PlanContentInput> = {}): PlanContentInput => ({
  tenantId: "ten_01JCP0TEST0000000000000000",
  status: "active",
  packageCode: "baslangic",
  packageLimits: fullLimits({ products: 500, staff: 3 }),
  packageFeatures: {},
  limitOverrides: [],
  flagOverrides: [],
  now: NOW,
  nodeEnv: "test",
  ...changes,
})

describe("a shop's plan document content (adr/0061 Ek C9)", () => {
  it("carries every limit, every platform flag and, without a subscription, the neutral billing", () => {
    const content = planContent(input())

    expect(content.limits).toEqual(fullLimits({ products: 500, staff: 3 }))
    expect(content.platform_flags).toEqual({ [VIDEOS]: true, [AI_OWN_KEYS]: true, [FLAG]: true })
    expect(content.billing).toEqual(NEUTRAL_BILLING)
    expect(planDocumentSchema.parse(planDocumentOf(content, 4, NOW))).toMatchObject({
      serial: 4,
      issued_at: "2026-11-11T09:00:00.000Z",
    })
  })

  it("applies an exception while it holds, then the package's value, then the default", () => {
    const later = new Date("2026-11-12T00:00:00Z")
    const overrides = [{ key: "products" as const, value: null, expires_at: later }]
    const flags = [{ key: FLAG, enabled: true, expires_at: later }]

    const now = planContent(
      input({ limitOverrides: overrides, flagOverrides: flags, packageFeatures: { [FLAG]: false } })
    )
    expect(now.limits.products).toBeNull()
    expect(now.platform_flags[FLAG]).toBe(true)

    const after = planContent(
      input({
        limitOverrides: overrides,
        flagOverrides: flags,
        packageFeatures: { [FLAG]: false },
        now: new Date("2026-11-13T00:00:00Z"),
      })
    )
    expect(after.limits.products).toBe(500)
    expect(after.platform_flags[FLAG]).toBe(false)
  })

  it("names only the flags in force under the environment", () => {
    expect(effectiveFlags({ [FLAG]: false, "gone.flag": true }, [], NOW, "production")).toEqual([
      { key: VIDEOS, default: true, package: undefined, override: undefined, value: true },
      { key: AI_OWN_KEYS, default: true, package: undefined, override: undefined, value: true },
    ])
    expect(effectiveFlags({ [VIDEOS]: false }, [], NOW, "test")).toEqual([
      { key: VIDEOS, default: true, package: false, override: undefined, value: false },
      { key: AI_OWN_KEYS, default: true, package: undefined, override: undefined, value: true },
      { key: FLAG, default: true, package: undefined, override: undefined, value: true },
    ])
  })

  it("hashes the same content the same way, whatever the key order", () => {
    const a = planContent(input())
    const b = { ...a, limits: Object.fromEntries(Object.entries(a.limits).reverse()) } as typeof a

    expect(contentHash(b)).toBe(contentHash(a))
    expect(contentHash(planContent(input({ status: "restricted" })))).not.toBe(contentHash(a))
  })

  it("never builds a document the contract would refuse", () => {
    expect(() => planDocumentOf(planContent(input({ packageCode: "Bad Code" })), 1, NOW)).toThrow()
    expect(() => planDocumentOf(planContent(input()), 0, NOW)).toThrow()
  })
})

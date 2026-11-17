import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { AI_MODULE } from ".."
import type AiModuleService from "../service"
import type { AiUsageInput } from "../service"

jest.setTimeout(120 * 1000)

const attempt = (over: Partial<AiUsageInput> = {}): AiUsageInput => ({
  task: "test_text",
  capability: "text",
  service: "fake",
  model: "fake-text",
  funding: "own_key",
  status: "succeeded",
  input_tokens: 100,
  output_tokens: 20,
  estimated_cost_micros: 50,
  currency: "USD",
  entity_type: "product",
  entity_id: "prod_1",
  duration_ms: 12,
  requested_by: "user_1",
  ...over,
})

/** adr/0071 §4, §5, §8 (PR 0b-3): the AI core's records. */
moduleIntegrationTestRunner<AiModuleService>({
  moduleName: AI_MODULE,
  resolve: "./src/modules/ai",
  testSuite: ({ service }) => {
    it("remembers a member's choice before the shop's, and the shop's for a new member", async () => {
      expect(await service.preferenceOf("user_a", "test_text")).toBeNull()

      await service.rememberChoice({ user_id: "user_a", task: "test_text", service: "deepseek" })
      await service.rememberChoice({ user_id: "user_b", task: "test_text", service: "gemini" })
      await service.rememberChoice({ user_id: "user_a", task: "other", service: "minimax" })

      expect(await service.preferenceOf("user_a", "test_text")).toBe("deepseek")
      expect(await service.preferenceOf("user_b", "test_text")).toBe("gemini")
      // A new member starts with the shop's last choice
      expect(await service.preferenceOf("user_c", "test_text")).toBe("gemini")
      expect(await service.preferenceOf(null, "other")).toBe("minimax")
      // One row each: a choice replaces the one before
      await service.rememberChoice({ user_id: "user_a", task: "test_text", service: "gemini" })
      expect(await service.preferenceOf("user_a", "test_text")).toBe("gemini")
      expect(await service.listAiPreferences({ task: "test_text" })).toHaveLength(3)
    })

    it("sums a Turkey month's attempts by service and task, failed ones counted apart", async () => {
      await service.recordUsage(attempt())
      await service.recordUsage(attempt({ status: "refused" }))
      await service.recordUsage(
        attempt({ service: "deepseek", status: "failed", estimated_cost_micros: null })
      )
      await service.recordUsage(attempt({ task: "seo_title", status: "timeout" }))
      const month = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 7)

      const summary = await service.usageSummary(month)

      expect(summary.month).toBe(month)
      expect(summary.services).toEqual([
        {
          id: "fake",
          count: 3,
          succeeded: 1,
          refused: 1,
          failed: 1,
          estimated_cost_micros: { USD: 150 },
        },
        {
          id: "deepseek",
          count: 1,
          succeeded: 0,
          refused: 0,
          failed: 1,
          estimated_cost_micros: {},
        },
      ])
      expect(summary.tasks.map((line) => [line.id, line.count])).toEqual([
        ["test_text", 3],
        ["seo_title", 1],
      ])
      expect((await service.usageSummary("2020-01")).services).toEqual([])
    })

    it("gives the day's last call to one of two asks at once, per group", async () => {
      const day = new Date("2026-03-15T10:00:00Z")
      expect(await service.claimDaily("text", 3, day)).toBe("2026-03-15")
      expect(await service.claimDaily("text", 3, day)).toBe("2026-03-15")

      const both = await Promise.all([
        service.claimDaily("text", 3, day),
        service.claimDaily("text", 3, day),
      ])

      expect(both.filter((each) => each !== null)).toHaveLength(1)
      expect(await service.usedToday("text", day)).toBe(3)
      // Another group has its own ceiling; a closed one (0) takes nothing
      expect(await service.claimDaily("image", 1, day)).toBe("2026-03-15")
      expect(await service.claimDaily("video", 0, day)).toBeNull()
      expect(await service.usedToday("video", day)).toBe(0)
    })

    it("starts each Turkey day afresh and gives a released call back, never below zero", async () => {
      const late = new Date("2026-04-30T20:30:00Z") // 23:30 on 30 April in Turkey
      const next = new Date("2026-04-30T21:30:00Z") // 00:30 on 1 May in Turkey

      expect(await service.claimDaily("text", 1, late)).toBe("2026-04-30")
      expect(await service.claimDaily("text", 1, late)).toBeNull()
      expect(await service.claimDaily("text", 1, next)).toBe("2026-05-01")

      await service.releaseDaily("text", "2026-04-30")
      await service.releaseDaily("text", "2026-04-30")
      expect(await service.usedToday("text", late)).toBe(0)
      expect(await service.claimDaily("text", 1, late)).toBe("2026-04-30")
    })
  },
})

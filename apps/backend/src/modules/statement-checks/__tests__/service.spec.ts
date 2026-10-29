import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { STATEMENT_CHECKS_MODULE } from ".."
import type StatementChecksModuleService from "../service"
import type { CheckResult } from "../service"

jest.setTimeout(120 * 1000)

const result = (over: Partial<CheckResult> = {}): CheckResult => ({
  provider: "paytr",
  day: "2026-10-28",
  test_mode: false,
  status: "matched",
  matched: 3,
  sales: 3,
  issues: [],
  error_code: null,
  checked_at: new Date("2026-10-29T05:30:00Z"),
  ...over,
})

moduleIntegrationTestRunner<StatementChecksModuleService>({
  moduleName: STATEMENT_CHECKS_MODULE,
  resolve: "./src/modules/statement-checks",
  testSuite: ({ service }) => {
    it("keeps one result per provider and day, the latest replacing the earlier", async () => {
      const first = await service.record(result({ status: "failed", error_code: "error_002" }))
      const issue = {
        kind: "missing_at_provider" as const,
        reference: "SIP001",
        order_id: "order_1",
        display_id: 7,
        shop: 12000,
        provider: 0,
      }
      const second = await service.record(result({ status: "mismatched", issues: [issue] }))

      expect(second).toEqual({
        id: first.id,
        previous: expect.objectContaining({ status: "failed" }) as unknown,
      })
      expect(await service.checkOf("paytr", "2026-10-28")).toMatchObject({
        status: "mismatched",
        issues: [issue],
        error_code: null,
      })
    })

    it("keeps a test account's check apart: it never replaces the live day", async () => {
      const live = await service.record(result({ status: "mismatched" }))
      const sandbox = await service.record(result({ test_mode: true }))

      expect(sandbox.id).not.toBe(live.id)
      expect(await service.checkOf("paytr", "2026-10-28")).toMatchObject({ status: "mismatched" })
      expect(await service.checkOf("paytr", "2026-10-28", true)).toMatchObject({
        status: "matched",
      })
    })

    it("records the same day twice at once as one check", async () => {
      await Promise.all([service.record(result()), service.record(result({ matched: 4 }))])

      expect(await service.listStatementChecks({ provider: "paytr" })).toHaveLength(1)
    })

    it("puts the earlier result back, or removes one that was not there", async () => {
      const first = await service.record(result())
      const second = await service.record(result({ status: "failed", error_code: "x" }))
      await service.restore(second.id, second.previous)
      const fresh = await service.record(result({ provider: "iyzico" }))
      await service.restore(fresh.id, fresh.previous)

      expect(await service.checkOf("paytr", "2026-10-28")).toMatchObject({
        id: first.id,
        status: "matched",
      })
      expect(await service.checkOf("iyzico", "2026-10-28")).toBeNull()
    })

    it("lists a range of days, the latest first", async () => {
      await service.record(result({ day: "2026-10-26" }))
      await service.record(result({ day: "2026-10-28", provider: "iyzico" }))
      await service.record(result({ day: "2026-10-28" }))
      await service.record(result({ day: "2026-10-20" }))

      const checks = await service.checksBetween("2026-10-25", "2026-10-28")

      expect(checks.map((check) => `${check.day} ${check.provider}`)).toEqual([
        "2026-10-28 iyzico",
        "2026-10-28 paytr",
        "2026-10-26 paytr",
      ])
    })
  },
})

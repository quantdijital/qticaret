import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { FRAUD_GUARD_MODULE } from ".."
import type FraudGuardModuleService from "../service"

jest.setTimeout(120 * 1000)

const email = { kind: "email" as const, match: "a".repeat(64), display: "ay***@example.com" }
const domain = { kind: "email_domain" as const, match: "yopmail.com", display: "yopmail.com" }

moduleIntegrationTestRunner<FraudGuardModuleService>({
  moduleName: FRAUD_GUARD_MODULE,
  resolve: "./src/modules/fraud-guard",
  testSuite: ({ service }) => {
    it("finds a live entry among a request's matches, and not a lapsed one", async () => {
      const now = new Date("2026-10-31T04:00:00Z")
      await service.addBlock({ ...email, reason: "chargeback" })
      await service.addBlock({ ...domain, expires_at: new Date("2026-10-30T00:00:00Z") })

      expect(await service.blockedBy([domain, email], now)).toMatchObject({ kind: "email" })
      expect(await service.blockedBy([domain], now)).toBeNull()
      expect(await service.blockedBy([], now)).toBeNull()
    })

    it("removes entries past their end for good, and keeps the rest", async () => {
      const now = new Date("2026-10-31T04:00:00Z")
      await service.addBlock({ ...email })
      await service.addBlock({ ...domain, expires_at: new Date("2026-10-30T00:00:00Z") })

      expect(await service.pruneExpired(now)).toBe(1)
      expect(
        (await service.listFraudBlocks({}, { withDeleted: true })).map((row) => row.kind)
      ).toEqual(["email"])
    })

    it("renews an entry added again instead of adding another", async () => {
      const first = await service.addBlock({ ...domain, reason: "one" })
      const again = await service.addBlock({ ...domain, reason: "two" })
      const rows = await service.listFraudBlocks({ kind: "email_domain" })

      expect(again.id).toBe(first.id)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.reason).toBe("two")
    })

    it("opens an order's review once, and lets one decision through", async () => {
      const reasons = [{ rule: "disposable_email" as const, points: 20 }]
      const opened = await service.openReview("order_1", 60, reasons)
      const again = await service.openReview("order_1", 60, reasons)

      expect(opened.opened).toBe(true)
      expect(again).toEqual({ id: opened.id, opened: false })
      expect(await service.heldStatus("order_1")).toBe("pending")

      const [one, two] = await Promise.all([
        service.decide({ id: opened.id, status: "approved", by: "user_1" }),
        service.decide({ id: opened.id, status: "rejected", by: "user_2", note: "x" }),
      ])
      expect([one, two].filter(Boolean)).toEqual([{ order_id: "order_1" }])
      const [decided] = await service.listFraudReviews({ id: opened.id })
      // Approved, it ships; turned down, it stays held until cancelled
      expect(await service.heldStatus("order_1")).toBe(
        decided?.status === "approved" ? null : "rejected"
      )
      const [row] = await service.listFraudReviews({ id: opened.id })
      expect(row?.reasons).toEqual({ reasons })
    })
  },
})

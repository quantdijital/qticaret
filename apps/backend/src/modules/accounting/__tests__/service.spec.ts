import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { ACCOUNTING_MODULE } from ".."
import type AccountingModuleService from "../service"
import { MAX_ATTEMPTS } from "../service"

jest.setTimeout(120 * 1000)

const later = (minutes: number) => new Date(Date.now() + minutes * 60_000)

moduleIntegrationTestRunner<AccountingModuleService>({
  moduleName: ACCOUNTING_MODULE,
  resolve: "./src/modules/accounting",
  testSuite: ({ service }) => {
    it("queues a record once, however often its event comes", async () => {
      const sale = { source_type: "sale" as const, source_id: "order_1" }

      const first = await service.enqueue("fake", [
        sale,
        { source_type: "payment", source_id: "capt_1" },
      ])
      const again = await service.enqueue("fake", [sale])
      const other = await service.enqueue("other", [sale])

      expect([first, again, other]).toEqual([2, 0, 1])
      expect(await service.counts("fake")).toEqual({ pending: 2, synced: 0, stopped: 0 })
    })

    it("gives each due record to one of two workers taking at once", async () => {
      await service.enqueue(
        "fake",
        Array.from({ length: 6 }, (_, n) => ({
          source_type: "sale" as const,
          source_id: `o${String(n)}`,
        }))
      )

      const [a, b] = await Promise.all([service.claimDue("fake", 4), service.claimDue("fake", 4)])
      const taken = [...a, ...b].map((row) => row.id)

      expect(taken).toHaveLength(6)
      expect(new Set(taken).size).toBe(6)
      // Taken: not due again until the lease runs out
      expect(await service.claimDue("fake", 10)).toEqual([])
      expect(await service.claimDue("fake", 10, later(11))).toHaveLength(6)
    })

    it("tries a failing record later and later, stops it after the last, and starts it again", async () => {
      await service.enqueue("fake", [{ source_type: "refund", source_id: "ref_1" }])
      const [row] = await service.claimDue("fake", 1)
      const id = row?.id ?? ""

      expect(await service.markFailed(id, 0, "unavailable")).toBe("pending")
      expect(await service.claimDue("fake", 1)).toEqual([])
      expect(await service.claimDue("fake", 1, later(2))).toHaveLength(1)
      expect(await service.markFailed(id, MAX_ATTEMPTS - 1, "unavailable")).toBe("stopped")
      expect(await service.claimDue("fake", 1, later(24 * 60))).toEqual([])

      expect(await service.retry(id)).toBe(true)
      expect(await service.retry(id)).toBe(false)
      const [back] = await service.claimDue("fake", 1)
      await service.markSynced(back?.id ?? "", "ext_1")

      expect(await service.counts("fake")).toEqual({ pending: 0, synced: 1, stopped: 0 })
    })
  },
})

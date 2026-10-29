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
      expect(await service.counts("fake")).toEqual({
        pending: 2,
        synced: 0,
        stopped: 0,
        skipped: 0,
      })
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
      if (!row) {
        throw new Error("nothing claimed")
      }

      expect(await service.markFailed(row, "unavailable")).toBe("pending")
      expect(await service.claimDue("fake", 1)).toEqual([])
      const [again] = await service.claimDue("fake", 1, later(2))
      expect(again).toMatchObject({ id: row.id, attempts: 1 })
      expect(await service.markFailed({ ...row, ...again, attempts: MAX_ATTEMPTS - 1 }, "x")).toBe(
        "stopped"
      )
      expect(await service.claimDue("fake", 1, later(24 * 60))).toEqual([])

      expect(await service.retry(row.id)).toBe(true)
      expect(await service.retry(row.id)).toBe(false)
      const [back] = await service.claimDue("fake", 1)
      expect(back && (await service.markSynced(back, "ext_1"))).toBe(true)

      expect(await service.counts("fake")).toEqual({
        pending: 0,
        synced: 1,
        stopped: 0,
        skipped: 0,
      })
    })

    it("lets a worker whose claim ran out change nothing (KK2)", async () => {
      await service.enqueue("fake", [{ source_type: "sale", source_id: "order_slow" }])
      const [slow] = await service.claimDue("fake", 1)
      // The slow worker's lease runs out; another takes the record and sends it
      const [fast] = await service.claimDue("fake", 1, later(11))
      if (!slow || !fast) {
        throw new Error("nothing claimed")
      }

      const sent = await service.markSynced(fast, "ext_fast")
      const lateFailure = await service.markFailed(slow, "timeout")
      const lateSuccess = await service.markSynced(slow, "ext_slow")
      const skipped = await service.markSkipped(slow, "accounting.order_canceled")

      expect([sent, lateFailure, lateSuccess, skipped]).toEqual([true, null, false, false])
      expect(await service.recordOf("fake", "sale", "order_slow")).toMatchObject({
        status: "synced",
        external_ref: "ext_fast",
      })
    })
  },
})

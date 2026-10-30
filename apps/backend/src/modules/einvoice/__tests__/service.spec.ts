import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { EINVOICE_MODULE } from ".."
import type EinvoiceModuleService from "../service"
import type { QueuedInvoice } from "../service"
import { MAX_ATTEMPTS } from "../service"

jest.setTimeout(120 * 1000)

const later = (minutes: number) => new Date(Date.now() + minutes * 60_000)

const sale = (orderId: string, provider: QueuedInvoice["provider"] = "fake"): QueuedInvoice => ({
  order_id: orderId,
  kind: "sale",
  source_id: orderId,
  provider,
  totals: { net: "229.92", vat: "45.98", gross: "275.90" },
})

moduleIntegrationTestRunner<EinvoiceModuleService>({
  moduleName: EINVOICE_MODULE,
  resolve: "./src/modules/einvoice",
  testSuite: ({ service }) => {
    it("queues an order's sale invoice once, however often its event comes (KK3)", async () => {
      const first = await service.enqueue(sale("order_1"))
      const again = await service.enqueue(sale("order_1"))
      const [row] = await service.listInvoices({ order_id: "order_1" })

      expect(first.created).toBe(true)
      expect(again).toEqual({ id: first.id, created: false })
      expect(row).toMatchObject({ status: "pending", provider: "fake", attempts: 0 })
      expect(Number(row?.gross_total)).toBe(275.9)
    })

    it("gives each due invoice to one of two workers, and none of an external program's", async () => {
      for (const n of [1, 2, 3, 4]) {
        await service.enqueue(sale(`o${String(n)}`))
      }
      await service.enqueue(sale("written_back", "external"))

      const [a, b] = await Promise.all([service.claimDue(10), service.claimDue(10)])
      const taken = [...a, ...b].map((row) => row.order_id).sort()

      expect(taken).toEqual(["o1", "o2", "o3", "o4"])
      expect(await service.claimDue(10)).toEqual([])
    })

    it("keeps what the program made through failures, and carries on from it", async () => {
      await service.enqueue(sale("order_2"))
      const [row] = await service.claimDue(1)
      if (!row) {
        throw new Error("nothing claimed")
      }

      await service.keep(row, { external_id: "ps_1" })
      const failed = await service.markFailed(row, "parasut.timeout")
      const [again] = await service.claimDue(1, later(2))

      expect(failed).toBe("pending")
      expect(again).toMatchObject({ attempts: 1, external_id: "ps_1", status: "pending" })
    })

    it("refuses a change from a worker whose claim another took", async () => {
      await service.enqueue(sale("order_3"))
      const [stale] = await service.claimDue(1)
      const [fresh] = await service.claimDue(1, later(6))
      if (!stale || !fresh) {
        throw new Error("nothing claimed")
      }

      expect(await service.markIssuing(stale, { job_id: "job_1" })).toBe(false)
      expect(
        await service.markIssuing(fresh, { job_id: "job_2", document_type: "e_archive" })
      ).toBe(true)
      const [row] = await service.listInvoices({ order_id: "order_3" })
      expect(row).toMatchObject({ status: "issuing", job_id: "job_2", document_type: "e_archive" })
    })

    it("stops after the last try, and on retry carries on asking about its job", async () => {
      await service.enqueue(sale("order_4"))
      let status: string | null = null
      for (let tried = 0; tried < MAX_ATTEMPTS; tried++) {
        const [row] = await service.claimDue(1, later(24 * 60 * (tried + 1)))
        if (!row) {
          throw new Error("nothing claimed")
        }
        if (tried === 0) {
          await service.markIssuing(row, { job_id: "job_4" })
        }
        status = await service.markFailed(row, "parasut.job_failed")
      }
      const [stopped] = await service.listInvoices({ order_id: "order_4" })
      const retried = await service.retry(stopped?.id ?? "")
      const [row] = await service.listInvoices({ order_id: "order_4" })

      expect(status).toBe("failed")
      expect(await service.counts()).toMatchObject({ issuing: 1, failed: 0 })
      expect(retried).toBe(true)
      expect(row).toMatchObject({
        status: "issuing",
        attempts: 0,
        last_error: "parasut.job_failed",
      })
    })

    it("keeps an issued invoice's number, and refuses the same number on another", async () => {
      await service.enqueue(sale("order_5"))
      await service.enqueue(sale("order_6"))
      const [first, second] = await service.claimDue(2)
      if (!first || !second) {
        throw new Error("nothing claimed")
      }
      const issued = {
        number: "QTC2026000000001",
        uuid: "5b6e3c0a-0000-4000-8000-000000000001",
        document_type: "e_archive" as const,
        issued_at: new Date(),
        cancellable_until: later(7 * 24 * 60),
        program_difference: null,
      }

      expect(await service.markIssued(first, issued)).toBe(true)
      await expect(service.markIssued(second, issued)).rejects.toThrow()
    })
  },
})

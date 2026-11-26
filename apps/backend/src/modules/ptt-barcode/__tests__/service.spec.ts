import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { PTT_BARCODE_MODULE } from ".."
import type PttBarcodeModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<PttBarcodeModuleService>({
  moduleName: PTT_BARCODE_MODULE,
  resolve: "./src/modules/ptt-barcode",
  testSuite: ({ service }) => {
    it("hands out each number once with its check digit, oldest range first, then says used up", async () => {
      await service.addRange({ first: "275036569845", last: "275036569846" })
      await service.addRange({ first: "100000000000", last: "100000000000" })

      const taken = [await service.allocate(), await service.allocate(), await service.allocate()]
      const after = await service.allocate()

      expect(taken).toEqual([
        { status: "ok", barcode: "2750365698456", remaining: 2 },
        { status: "ok", barcode: expect.stringMatching(/^275036569846\d$/) as unknown, remaining: 1 },
        { status: "ok", barcode: expect.stringMatching(/^100000000000\d$/) as unknown, remaining: 0 },
      ])
      expect(after).toEqual({ status: "exhausted" })
    })

    it("says missing without a range", async () => {
      expect(await service.allocate()).toEqual({ status: "missing" })
    })

    it("never hands out the same number to two parcels shipped at once", async () => {
      await service.addRange({ first: "500000000000", last: "500000000099" })

      const taken = await Promise.all(Array.from({ length: 40 }, () => service.allocate()))
      const barcodes = taken.map((each) => (each.status === "ok" ? each.barcode : null))

      expect(barcodes.every(Boolean)).toBe(true)
      expect(new Set(barcodes).size).toBe(40)
      const view = await service.overview()
      expect(view).toMatchObject({ remaining: 60, total: 100, low: false })
      expect(view.ranges[0]).toMatchObject({ used: 40, size: 100 })
    })

    it("refuses a malformed, reversed, oversized or overlapping range", async () => {
      await service.addRange({ first: "600000000100", last: "600000000199" })
      const refusal = (first: string, last: string) =>
        service.addRange({ first, last }).then(
          () => null,
          (error: unknown) => (error as { safeMessage?: string }).safeMessage
        )

      expect(await refusal("6000000001", "600000000199")).toBe("ptt.barcode_range_invalid")
      expect(await refusal("600000000300", "600000000200")).toBe("ptt.barcode_range_reversed")
      expect(await refusal("600000000000", "600002000000")).toBe("ptt.barcode_range_too_large")
      expect(await refusal("600000000150", "600000000250")).toBe("ptt.barcode_range_overlaps")
      expect(await refusal("600000000000", "600000000100")).toBe("ptt.barcode_range_overlaps")
      expect(await refusal("600000000200", "600000000299")).toBeNull()
    })

    it("removes an unused range, never one in use, and warns when few are left", async () => {
      const { id: used } = await service.addRange({ first: "700000000000", last: "700000000059" })
      const { id: unused } = await service.addRange({ first: "710000000000", last: "710000000009" })
      await service.allocate()

      expect(await service.removeRange(unused)).toMatchObject({ first: "710000000000" })
      await expect(service.removeRange(used)).rejects.toMatchObject({
        safeMessage: "ptt.barcode_range_in_use",
      })
      expect(await service.removeRange("pttbr_missing")).toBeNull()
      expect(await service.overview()).toMatchObject({ remaining: 59, total: 60, low: false })
      for (let index = 0; index < 10; index += 1) {
        await service.allocate()
      }
      expect(await service.overview()).toMatchObject({ remaining: 49, low: true })
    })
  },
})

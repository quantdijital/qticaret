import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { PRICE_HISTORY_MODULE } from ".."
import type PriceHistoryModuleService from "../service"

jest.setTimeout(120 * 1000)

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY)

const record = (amount: number, at: Date, overrides: Record<string, unknown> = {}) => ({
  variant_id: "variant_1",
  currency_code: "try",
  amount,
  original_amount: amount,
  price_list_id: null,
  reason: "price_change" as const,
  recorded_at: at,
  ...overrides,
})

moduleIntegrationTestRunner<PriceHistoryModuleService>({
  moduleName: PRICE_HISTORY_MODULE,
  resolve: "./src/modules/price-history",
  testSuite: ({ service }) => {
    it("reads each variant's last price per currency", async () => {
      await service.recordPrices([
        record(100, daysAgo(10)),
        record(90, daysAgo(2), { original_amount: 100, price_list_id: "plist_1" }),
        record(5, daysAgo(3), { currency_code: "eur" }),
        record(40, daysAgo(1), { variant_id: "variant_2" }),
      ])
      const last = await service.lastPrices(["variant_1", "variant_2", "variant_3"], ["try"])
      expect(last).toEqual([
        {
          variant_id: "variant_1",
          currency_code: "try",
          amount: "90",
          original_amount: "100",
          price_list_id: "plist_1",
        },
        {
          variant_id: "variant_2",
          currency_code: "try",
          amount: "40",
          original_amount: "40",
          price_list_id: null,
        },
      ])
      expect(await service.lastPrices([], ["try"])).toEqual([])
    })

    it("reads the price in force at a moment and every later one, oldest first", async () => {
      await service.recordPrices([
        record(120, daysAgo(60)),
        record(110, daysAgo(40)),
        record(100, daysAgo(20)),
        record(80, daysAgo(5)),
      ])
      const since = await service.pricesSince("variant_1", "try", daysAgo(30))
      expect(since.map((row) => row.amount)).toEqual([110, 100, 80])
      expect(await service.pricesSince("variant_9", "try", daysAgo(30))).toEqual([])
    })

    it("refuses to change or remove a record", async () => {
      const [row] = await service.recordPrices([record(100, new Date())])
      const update = service.updatePriceRecords as unknown as (input: unknown) => unknown
      const remove = service.deletePriceRecords as unknown as (ids: string[]) => unknown
      expect(() => update({ id: row?.id, amount: "1.00" })).toThrow("append-only")
      expect(() => remove([row?.id ?? ""])).toThrow("append-only")
      expect(row?.id).toMatch(/^prcr_/)
    })
  },
})

import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { SEARCH_TERMS_MODULE } from ".."
import type SearchTermsModuleService from "../service"
import { MAX_TERMS_A_DAY } from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<SearchTermsModuleService>({
  moduleName: SEARCH_TERMS_MODULE,
  resolve: "./src/modules/search-terms",
  testSuite: ({ service }) => {
    it("counts a term's searches by day, those that found nothing apart, at once too", async () => {
      await Promise.all([
        service.record("2026-10-28", "kupa", 3),
        service.record("2026-10-28", "kupa", 0),
        service.record("2026-10-29", "kupa", 2),
        service.record("2026-10-29", "şamdan", 0),
      ])

      const ranked = await service.ranked("2026-10-28", "2026-10-29", { limit: 10 })
      const zero = await service.ranked("2026-10-28", "2026-10-29", { limit: 10, zeroOnly: true })
      const totals = await service.totals("2026-10-28", "2026-10-29")

      expect(ranked).toEqual([
        { term: "kupa", searches: 3, zero_results: 1 },
        { term: "şamdan", searches: 1, zero_results: 1 },
      ])
      expect(zero.map((row) => row.term)).toEqual(["kupa", "şamdan"])
      expect(totals).toEqual({ searches: 4, zero_results: 2, terms: 2, zero_terms: 2 })
    })

    it("adds no term to a full day, and still counts the day's own", async () => {
      const day = "2026-10-27"
      await service.createSearchTermDays(
        Array.from({ length: MAX_TERMS_A_DAY }, (_, n) => ({
          day,
          term: `terim ${String(n)}`,
          searches: 1,
          zero_results: 0,
        }))
      )

      await service.record(day, "yeni terim", 0)
      await service.record(day, "terim 7", 0)
      await service.record("2026-10-28", "yeni terim", 0)

      const [known] = await service.listSearchTermDays({ day, term: "terim 7" })
      expect(await service.listSearchTermDays({ day, term: "yeni terim" })).toEqual([])
      expect(known).toMatchObject({ searches: 2, zero_results: 1 })
      expect(await service.listSearchTermDays({ day: "2026-10-28" })).toHaveLength(1)
    })

    it("drops the days before the one kept from", async () => {
      await service.record("2026-04-01", "eski", 1)
      await service.record("2026-10-29", "yeni", 1)

      expect(await service.prune("2026-05-02")).toBe(1)
      expect((await service.listSearchTermDays({})).map((row) => row.term)).toEqual(["yeni"])
    })
  },
})

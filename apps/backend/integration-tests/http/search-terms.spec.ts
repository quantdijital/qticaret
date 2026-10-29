import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { SEARCH_TERMS_MODULE } from "../../src/modules/search-terms"
import type SearchTermsModuleService from "../../src/modules/search-terms/service"
import { searchFinding } from "../../src/workflows/seo/audit/search"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface SearchReport {
  totals: { searches: number; zero_results: number; terms: number; zero_terms: number }
  top: { term: string; searches: number; zero_results: number }[]
  zero: { term: string; searches: number; zero_results: number }[]
}

/** F11.8 (adr/0039 §8): storefront searches counted by day, nothing of the shopper, for the advisor. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront
    let admin: { headers: Record<string, string> }

    const search = (q: string, offset = 0) =>
      settle(
        http.get(`/store/products?q=${encodeURIComponent(q)}&offset=${String(offset)}`, {
          headers: storefront.headers,
        })
      )
    const stored = () =>
      getContainer()
        .resolve<SearchTermsModuleService>(SEARCH_TERMS_MODULE)
        .listSearchTermDays({}, { select: ["term", "searches", "zero_results"] })

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
      admin = await createAdminUser(http, getContainer())
      await createTestProduct(getContainer(), storefront.salesChannelId, {
        handle: "seramik-kupa",
        price: 120,
      })
    })

    it("counts a search and whether it found anything, the first page only", async () => {
      await search("Seramik")
      await search("  seramik ")
      await search("seramik", 20)
      await search("şamdan")
      await search("ŞAMDAN")
      await search("şamdan")

      // Counted after the answer: wait for all five
      const rows = await eventually(
        stored,
        (list) => list.reduce((sum, row) => sum + row.searches, 0) === 5
      )
      const report = await http.get<SearchReport>("/admin/reports/search?period=today", {
        headers: admin.headers,
      })
      const audit = await searchFinding(getContainer(), new Date())

      expect(
        rows.map(({ term, searches, zero_results }) => ({ term, searches, zero_results }))
      ).toEqual(
        expect.arrayContaining([
          { term: "seramik", searches: 2, zero_results: 0 },
          { term: "şamdan", searches: 3, zero_results: 3 },
        ])
      )
      expect(report.data.totals).toEqual({ searches: 5, zero_results: 3, terms: 2, zero_terms: 1 })
      expect(report.data.top.map((row) => row.term)).toEqual(["şamdan", "seramik"])
      expect(report.data.zero).toEqual([{ term: "şamdan", searches: 3, zero_results: 3 }])
      expect(audit).toMatchObject({
        ruleId: "S-SEARCH-01",
        count: 1,
        items: [{ reason: "zero_results", subject: "şamdan", count: 3 }],
      })
    })

    it("keeps nothing of a search that may hold a person", async () => {
      await search("ayse.yilmaz@example.com")
      await search("0532 000 00 00")
      await search("sipariş 10000000146")
      await search("seramik")

      const rows = await eventually(stored, (list) => list.length === 1)

      expect(rows.map((row) => row.term)).toEqual(["seramik"])
    })
  },
})

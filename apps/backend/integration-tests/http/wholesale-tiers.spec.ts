import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { WHOLESALE_MODULE } from "../../src/modules/wholesale"
import type WholesaleModuleService from "../../src/modules/wholesale/service"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { tierRecords, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface AuditEntry {
  action: string
  resource_type: string | null
  changes: { diff?: Record<string, unknown> } | null
}

/** ADR-0068 slice 1a: wholesale levels, their rate and hand-entered prices, the flag and roles. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let shop: StockShop

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      staff = wholesaleApi(http, admin.headers)
      shop = await stockShop(getContainer())
    })

    it("answers as missing while the flag is off, the default", async () => {
      expect((await staff.get("/admin/wholesale/tiers")).status).toBe(404)
      expect((await staff.post("/admin/wholesale/tiers", { name: "Toptan A" })).status).toBe(404)
    })

    it("lets only the owner and admin reach the levels", async () => {
      await staff.flag(true)
      for (const role of ["operations", "readonly"] as const) {
        const other = await createAdminUser(http, getContainer(), role)
        const read = await settle(http.get("/admin/wholesale/tiers", { headers: other.headers }))
        expect({ role, status: read.status }).toEqual({ role, status: 403 })
      }
      const admin = await createAdminUser(http, getContainer(), "admin")
      const read = await settle(http.get("/admin/wholesale/tiers", { headers: admin.headers }))
      expect(read.status).toBe(200)
    })

    it("writes a rate's prices in the background and follows a new own price", async () => {
      await staff.flag(true)
      const knife = await stockedProduct(getContainer(), shop, "toptan-oran", null, 33.33)
      const tier = await staff.tier({ name: "Toptan Oran", percent: 15, min_quantity: 10 })
      expect(tier).toMatchObject({ percent: 15, min_quantity: 10 })

      const written = await eventually(
        () => staff.lines(tier.id, "q=toptan-oran"),
        ({ lines }) => lines.some((line) => line.variant_id === knife.variantId),
        150
      )
      // 33.33 less 15% is 28.3305: 28.33, net 23.61 at KDV 20%
      expect(written.lines.find((line) => line.variant_id === knife.variantId)).toMatchObject({
        gross: "28.33",
        net: "23.61",
        source: "rate",
      })

      // Every variant of the shop is on the list: a page at a time, found by name
      const everything = await eventually(
        () => staff.lines(tier.id, "limit=100"),
        ({ count, lines }) => count > 2 && lines.length === count,
        150
      )
      const first = await staff.lines(tier.id, "limit=2")
      const second = await staff.lines(tier.id, "limit=2&offset=2")
      expect({ first: first.lines.length, count: first.count }).toEqual({
        first: 2,
        count: everything.count,
      })
      expect([...first.lines, ...second.lines].map((line) => line.variant_id)).toEqual(
        everything.lines.slice(0, 4).map((line) => line.variant_id)
      )
      expect(await staff.lines(tier.id, "q=yok-boyle-bir-urun")).toMatchObject({
        lines: [],
        count: 0,
      })
      expect((await staff.get(`/admin/wholesale/tiers/${tier.id}/lines?limit=1000`)).status).toBe(
        400
      )

      await updateProductVariantsWorkflow(getContainer()).run({
        input: {
          product_variants: [
            { id: knife.variantId, prices: [{ currency_code: "try", amount: 50 }] },
          ],
        },
      })
      const followed = await eventually(
        () => staff.lines(tier.id, "q=toptan-oran"),
        ({ lines }) => lines.some((line) => line.gross === "42.50"),
        50
      )
      expect(followed.lines.map((line) => line.gross)).toContain("42.50")
    })

    it("keeps a hand-entered price, KDV excluded, through rate changes and back", async () => {
      await staff.flag(true)
      const board = await stockedProduct(getContainer(), shop, "toptan-elle", null, 100)
      // The rate prices the demo catalogue too: this product's line alone
      const ELLE = "q=toptan-elle"
      const tier = await staff.tier({ name: "Toptan Elle" })
      const set = await staff.prices(tier.id, {
        set: [{ variant_id: board.variantId, net: "8.33" }],
      })
      expect(set.data).toMatchObject({ written: 1, rows: { created: 1 } })
      expect((await staff.lines(tier.id, ELLE)).lines).toMatchObject([
        { net: "8.33", gross: "10.00", source: "manual" },
      ])

      await staff.post(`/admin/wholesale/tiers/${tier.id}`, { percent: 50 })
      // The rate's pass leaves the hand-entered row as it was
      await eventually(
        () => staff.get<{ tier: { sync_pending: boolean } }>(`/admin/wholesale/tiers/${tier.id}`),
        ({ data }) => !data.tier.sync_pending,
        150
      )
      expect((await staff.lines(tier.id, ELLE)).lines).toMatchObject([
        { net: "8.33", gross: "10.00", source: "manual" },
      ])

      // Taken away, the rate prices the variant again
      await staff.prices(tier.id, { remove: [board.variantId] })
      expect((await staff.lines(tier.id, ELLE)).lines).toMatchObject([
        { gross: "50.00", source: "rate" },
      ])
      const unknown = await staff.prices(tier.id, { set: [{ variant_id: "variant_x", net: "1" }] })
      expect([unknown.status, (unknown.data as { message?: string }).message]).toEqual([
        400,
        "wholesale.variant_unknown",
      ])
    })

    it("writes no row where the rate leaves a variant at 0,00, and names it (L3)", async () => {
      await staff.flag(true)
      const penny = await stockedProduct(getContainer(), shop, "toptan-kurus", null, 0.01)
      const tier = await staff.tier({ name: "Toptan Sıfır", percent: 99 })
      await eventually(
        () => staff.get<{ tier: { sync_pending: boolean } }>(`/admin/wholesale/tiers/${tier.id}`),
        ({ data }) => !data.tier.sync_pending,
        150
      )
      const lines = await staff.lines(tier.id, "q=toptan-kurus")
      expect(lines.count).toBe(0)
      expect(lines.rate_zero.variant_ids).toContain(penny.variantId)
      expect(lines.rate_zero.count).toBeGreaterThanOrEqual(1)
    })

    it("refuses a second level of a name and records the level's changes", async () => {
      await staff.flag(true)
      const tier = await staff.tier({ name: "Toptan Kayıt" })
      const again = await staff.post("/admin/wholesale/tiers", { name: "Toptan Kayıt" })
      expect([again.status, (again.data as { message?: string }).message]).toEqual([
        409,
        "wholesale.tier_exists",
      ])

      await staff.post(`/admin/wholesale/tiers/${tier.id}`, { name: "Toptan Yeni", percent: 10 })
      const entries = await eventually(
        async () =>
          (
            await staff.get<{ audit_entries: AuditEntry[] }>(
              `/admin/audit-log?resource_id=${tier.id}&kind=mutation`
            )
          ).data.audit_entries,
        (found) => found.length > 0
      )
      expect(entries[0]).toMatchObject({
        action: "POST /admin/wholesale/tiers/:id",
        resource_type: "wholesale_tier",
      })
      expect(JSON.stringify(entries[0]?.changes?.diff)).toContain("Toptan Yeni")
    })

    it("takes a level away with its group and list, never one a wholesaler is on", async () => {
      await staff.flag(true)
      const kept = await staff.tier({ name: "Toptan Dolu" })
      await getContainer()
        .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
        .createWholesaleAccounts({ customer_id: "cus_dolu", status: "active", tier_id: kept.id })
      const inUse = await staff.del(`/admin/wholesale/tiers/${kept.id}`)
      expect([inUse.status, (inUse.data as { message?: string }).message]).toEqual([
        409,
        "wholesale.tier_in_use",
      ])

      const gone = await staff.tier({ name: "Toptan Boş" })
      const { groupId, priceListId } = await tierRecords(getContainer(), gone.id)
      expect((await staff.del(`/admin/wholesale/tiers/${gone.id}`)).status).toBe(200)
      expect((await staff.get(`/admin/price-lists/${priceListId}`)).status).toBe(404)
      expect((await staff.get(`/admin/customer-groups/${groupId}`)).status).toBe(404)
      expect((await staff.get(`/admin/wholesale/tiers/${gone.id}`)).status).toBe(404)
    })
  },
})

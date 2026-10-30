import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { MIGRATION_MODULE } from ".."
import type MigrationModuleService from "../service"
import type { LegacyOrderInput } from "../service"

jest.setTimeout(120 * 1000)

const order = (key: string, changes: Partial<LegacyOrderInput> = {}): LegacyOrderInput => ({
  source_key: key,
  number: `#${key}`,
  placed_at: new Date("2025-06-01T09:00:00Z"),
  currency_code: "try",
  total: "1299.90",
  status: "fulfilled",
  customer_id: null,
  email: "ayse@example.com",
  lines: [{ title: "Döküm Tava", sku: "TAVA-1", quantity: 1, total: "1299.90" }],
  ...changes,
})

moduleIntegrationTestRunner<MigrationModuleService>({
  moduleName: MIGRATION_MODULE,
  resolve: "./src/modules/migration",
  testSuite: ({ service }) => {
    it("keeps what each source record became once, bringing it up to date when met again (KK2)", async () => {
      await service.remember("bundle", "product", [
        { source_key: "p1", target_id: null, status: "failed", error_code: "x", old_url: "/u/1" },
        { source_key: "p2", target_id: "prod_2", status: "done" },
      ])
      await service.remember("bundle", "product", [
        { source_key: "p1", target_id: "prod_1", status: "done" },
      ])
      // The same key of another kind, or another source, is another record
      await service.remember("bundle", "category", [
        { source_key: "p1", target_id: "pcat_1", status: "done" },
      ])
      await service.remember("shopify", "product", [
        { source_key: "p1", target_id: "prod_9", status: "done" },
      ])

      const rows = await service.listMigrationItems({ source: "bundle", kind: "product" })
      const found = await service.targetsOf("bundle", "product", ["p1", "p2", "p3"])

      expect(rows).toHaveLength(2)
      expect(rows.find((row) => row.source_key === "p1")).toMatchObject({
        target_id: "prod_1",
        status: "done",
        error_code: null,
        // A later run without the address keeps the one known
        old_url: "/u/1",
      })
      expect([...found.entries()].sort(([a], [b]) => a.localeCompare(b))).toEqual([
        ["p1", { target_id: "prod_1", status: "done" }],
        ["p2", { target_id: "prod_2", status: "done" }],
      ])
    })

    it("takes a key or an address met twice in one call as one (one statement touches a row once)", async () => {
      await service.remember("bundle", "product", [
        { source_key: "p9", target_id: null, status: "failed" },
        { source_key: "p9", target_id: "prod_9", status: "done" },
      ])
      expect(await service.targetsOf("bundle", "product", ["p9"])).toEqual(
        new Map([["p9", { target_id: "prod_9", status: "done" }]])
      )
      await service.addUrls([
        { address: "/a", path: "/a", query: null, origin: "sitemap", clicks: 3 },
        { address: "/a", path: "/a", query: null, origin: "sitemap", clicks: 7 },
      ])
      const [row] = await service.listMigrationUrls({ address: "/a" })
      expect(row?.clicks).toBe(7)
    })

    it("never forgets a target a later failure does not name", async () => {
      await service.remember("bundle", "customer", [
        { source_key: "c1", target_id: "cus_1", status: "done" },
      ])
      await service.remember("bundle", "customer", [
        { source_key: "c1", target_id: null, status: "failed", error_code: "e" },
      ])
      const found = await service.targetsOf("bundle", "customer", ["c1"])
      expect(found.get("c1")).toEqual({ target_id: "cus_1", status: "failed" })
    })

    it("keeps an old order once, and refuses one kept meanwhile by its key", async () => {
      await service.addLegacyOrders("bundle", [order("o1"), order("o2")])
      const kept = await service.keptLegacyOrders("bundle", ["o1", "o2", "o3"])
      expect([...kept].sort()).toEqual(["o1", "o2"])

      await expect(service.addLegacyOrders("bundle", [order("o1")])).rejects.toThrow()
      await service.addLegacyOrders("other", [order("o1")])

      const [row] = await service.listLegacyOrders({ source: "bundle", source_key: "o1" })
      expect(row).toMatchObject({ number: "#o1", currency_code: "try", status: "fulfilled" })
      expect(Number(row?.total)).toBe(1299.9)
      expect(row?.lines).toEqual({
        lines: [{ title: "Döküm Tava", sku: "TAVA-1", quantity: 1, total: "1299.90" }],
      })
    })

    it("adds a kind's counts to its run's as the run goes", async () => {
      const run = await service.createMigrationRuns({ source: "bundle", mode: "check" })
      await service.count(run.id, "product", { read: 3, created: 2 })
      await service.count(run.id, "product", { created: 1 })
      await service.count(run.id, "customer", { read: 5 })
      const after = await service.retrieveMigrationRun(run.id)
      expect(after.counts).toEqual({ product: { read: 3, created: 3 }, customer: { read: 5 } })
      expect(after.status).toBe("running")
    })
  },
})

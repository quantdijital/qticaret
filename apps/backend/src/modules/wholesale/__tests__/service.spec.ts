import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { WHOLESALE_MODULE } from ".."
import type WholesaleModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<WholesaleModuleService>({
  moduleName: WHOLESALE_MODULE,
  resolve: "./src/modules/wholesale",
  testSuite: ({ service }) => {
    const tier = (name: string, rate: number | null = null) =>
      service.createWholesaleTiers({
        name,
        customer_group_id: `cusgroup_${name}`,
        price_list_id: `plist_${name}`,
        rate_bps: rate,
      })

    it("names every list and group it owns: the levels' and the wholesalers' own", async () => {
      await tier("a", 1500)
      await service.createWholesaleAccounts({
        customer_id: "cus_1",
        status: "active",
        private_group_id: "cusgroup_own",
        private_price_list_id: "plist_own",
      })
      // A pending account without its own list owns nothing yet
      await service.createWholesaleAccounts({ email: "bayi@example.com" })

      const lists = await service.wholesaleLists()
      expect(lists.map((list) => [list.kind, list.price_list_id, list.rate_bps]).sort()).toEqual([
        ["level", "plist_a", 1500],
        ["private", "plist_own", null],
      ])
      const owned = await service.ownedIds()
      expect([...owned.priceListIds].sort()).toEqual(["plist_a", "plist_own"])
      expect([...owned.groupIds].sort()).toEqual(["cusgroup_a", "cusgroup_own"])
    })

    it("keeps one level per name and one hand-entered price per list and variant", async () => {
      await tier("b")
      await expect(tier("b")).rejects.toThrow()
      await service.createWholesaleManualPrices({
        price_list_id: "plist_b",
        variant_id: "variant_1",
        net_amount: 125_000,
      })
      await expect(
        service.createWholesaleManualPrices({
          price_list_id: "plist_b",
          variant_id: "variant_1",
          net_amount: 1,
        })
      ).rejects.toThrow()
    })

    it("knows a list asked to be written again until a pass that started after it", async () => {
      const created = await tier("c", 1000)
      const list = { kind: "level" as const, owner_id: created.id }
      await service.requestSync(list, new Date("2026-11-15T10:00:00Z"))
      await service.recordSynced(list, new Date("2026-11-15T09:59:00Z"))
      let [pending] = await service.wholesaleLists()
      expect(pending?.synced_at?.getTime()).toBeLessThan(pending?.sync_requested_at?.getTime() ?? 0)
      await service.recordSynced(list, new Date("2026-11-15T10:01:00Z"))
      ;[pending] = await service.wholesaleLists()
      expect(pending?.synced_at?.toISOString()).toBe("2026-11-15T10:01:00.000Z")
    })
  },
})

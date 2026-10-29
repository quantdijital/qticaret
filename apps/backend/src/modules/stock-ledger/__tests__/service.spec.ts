import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { STOCK_LEDGER_MODULE } from ".."
import type StockLedgerModuleService from "../service"

jest.setTimeout(120 * 1000)

const movement = (stocked: number, reserved: number) => ({
  inventory_item_id: "iitem_1",
  location_id: "sloc_1",
  delta_stocked: stocked,
  stocked_after: 10 + stocked,
  delta_reserved: reserved,
  reserved_after: reserved,
  reason: "manual" as const,
})

moduleIntegrationTestRunner<StockLedgerModuleService>({
  moduleName: STOCK_LEDGER_MODULE,
  resolve: "./src/modules/stock-ledger",
  testSuite: ({ service }) => {
    it("appends movements and reads the level's last one", async () => {
      const first = await service.recordMovement(movement(10, 0))
      const second = await service.recordMovement({ ...movement(-2, 1), reference: "order_1" })
      expect(first.id).toMatch(/^stmv_/)
      expect(await service.lastMovement("iitem_1", "sloc_1")).toMatchObject({
        id: second.id,
        reference: "order_1",
        actor_id: null,
      })
      expect(await service.lastMovement("iitem_1", "sloc_2")).toBeNull()
    })

    it("tells what was on the shelf at a moment, both locations together", async () => {
      const pause = () =>
        new Promise((resolve) => {
          setTimeout(resolve, 50)
        })
      const before = new Date(Date.now() - 1000)
      // 10 → 20 at one location, 3 → 7 at another
      await service.recordMovement(movement(10, 0))
      await service.recordMovement({ ...movement(4, 0), location_id: "sloc_2", stocked_after: 7 })
      await pause()
      const between = new Date()
      await pause()
      await service.recordMovement({ ...movement(-5, 0), stocked_after: 15 })

      expect(await service.stockedAt(["iitem_1", "iitem_none"], before)).toEqual(
        new Map([["iitem_1", 13]])
      )
      expect((await service.stockedAt(["iitem_1"], between)).get("iitem_1")).toBe(27)
      expect((await service.stockedAt(["iitem_1"], new Date())).get("iitem_1")).toBe(22)
    })

    it("refuses to change or remove a movement", async () => {
      const row = await service.recordMovement(movement(5, 0))
      // Called as a caller would, whatever the arguments
      const update = service.updateStockMovements as unknown as (input: unknown) => unknown
      const remove = service.deleteStockMovements as unknown as (ids: string[]) => unknown
      expect(() => update({ id: row.id, delta_stocked: 9 })).toThrow("append-only")
      expect(() => remove([row.id])).toThrow("append-only")
      expect(await service.lastMovement("iitem_1", "sloc_1")).toMatchObject({ id: row.id })
    })

    it("keeps one watch per item", async () => {
      await service.createStockWatches({ inventory_item_id: "iitem_1", threshold: 3 })
      await expect(service.createStockWatches({ inventory_item_id: "iitem_1" })).rejects.toThrow()
    })
  },
})

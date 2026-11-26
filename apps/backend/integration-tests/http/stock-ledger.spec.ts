import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import stockReconcile from "../../src/jobs/stock-reconcile"
import openingBalances from "../../src/migration-scripts/stock-ledger-opening-balances"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { STOCK_LEDGER_MODULE } from "../../src/modules/stock-ledger"
import type StockLedgerModuleService from "../../src/modules/stock-ledger/service"
import { recordStockWorkflow } from "../../src/workflows/stock/ledger"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { firstLineOf, orderOne, stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(120 * 1000)

interface Movement {
  reason: string
  delta_stocked: number
  delta_reserved: number
  stocked_after: number
  reserved_after: number
  location_name: string | null
  reference: string | null
}

/** F3.8 (adr/0020): the stock ledger, its reasons, and the low-stock alert (KK). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    const post = <T>(url: string, body: unknown = {}) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    /** The item's movements, oldest first, once there are `count` of them. */
    async function movementsOf(itemId: string, count: number): Promise<Movement[]> {
      let movements: Movement[] = []
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ movements: Movement[] }>(
          `/admin/stock-items/${itemId}/movements`,
          admin
        )
        movements = [...data.movements].reverse()
        if (movements.length >= count) {
          return movements
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error(`expected ${String(count)} movements: ${JSON.stringify(movements)}`)
    }

    const lowStockAlerts = async (itemId: string) => {
      const { data } = await http.get<{ notifications: { data: Record<string, unknown> }[] }>(
        "/admin/notifications?channel=feed&limit=50",
        admin
      )
      return data.notifications.filter(
        (each) => each.data["kind"] === "low_stock" && each.data["inventory_item_id"] === itemId
      )
    }

    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    /** The item's alerts once there are `count`, and a moment later, for any extra to show. */
    async function alertsOf(itemId: string, count: number) {
      for (let attempt = 0; attempt < 50; attempt++) {
        if ((await lowStockAlerts(itemId)).length >= count) {
          break
        }
        await pause(100)
      }
      await pause(300)
      return lowStockAlerts(itemId)
    }

    /** Once the item was seen above its line (its watch is armed). */
    async function armed(itemId: string) {
      const ledger = getContainer().resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
      for (let attempt = 0; attempt < 50; attempt++) {
        const [watch] = await ledger.listStockWatches({ inventory_item_id: itemId })
        if (watch?.armed_at) {
          return
        }
        await pause(100)
      }
      throw new Error(`${itemId} was never armed`)
    }

    const setLevel = (itemId: string, stocked: number) =>
      updateInventoryLevelsWorkflow(getContainer()).run({
        input: {
          updates: [
            { inventory_item_id: itemId, location_id: shop.locationId, stocked_quantity: stocked },
          ],
        },
      })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    afterEach(async () => {
      await settings().saveSection("inventory", { low_stock_threshold: 5 }, null)
    })

    it("records each change with why it happened, once", async () => {
      const { variantId, itemId } = await stockedProduct(getContainer(), shop, "defter-kupa", 5)
      const reserved = await orderOne(getContainer(), shop, variantId)
      const shipped = await orderOne(getContainer(), shop, variantId)
      await post(`/admin/orders/${reserved}/cancel`)
      await post(`/admin/orders/${shipped}/fulfillments`, {
        items: [{ id: await firstLineOf(getContainer(), shipped), quantity: 1 }],
        location_id: shop.locationId,
      })

      const movements = await movementsOf(itemId, 5)
      // Medusa's reservation events name no order; the ledger finds it from the order line
      expect(movements.map((movement) => movement.reference)).toEqual([
        null,
        reserved,
        shipped,
        reserved,
        shipped,
      ])
      expect(
        movements.map(({ reason, delta_stocked, delta_reserved }) => [
          reason,
          delta_stocked,
          delta_reserved,
        ])
      ).toEqual([
        ["manual", 5, 0],
        ["order", 0, 1],
        ["order", 0, 1],
        ["cancel", 0, -1],
        ["order", -1, -1],
      ])
      expect(movements.at(-1)).toMatchObject({
        stocked_after: 4,
        reserved_after: 0,
        location_name: "Ana Depo",
      })

      // An event delivered again finds nothing new
      await recordStockWorkflow(getContainer()).run({
        input: { levels: [{ inventory_item_id: itemId, location_id: shop.locationId }] },
      })
      expect(await movementsOf(itemId, 5)).toHaveLength(5)
    })

    it("alerts once when an item runs low, and again only after it was restocked (KK)", async () => {
      await settings().saveSection("inventory", { low_stock_threshold: 3 }, null)
      const { productId, variantId, itemId } = await stockedProduct(
        getContainer(),
        shop,
        "uyari-kupa",
        5
      )
      await movementsOf(itemId, 1)

      await orderOne(getContainer(), shop, variantId)
      await movementsOf(itemId, 2)
      expect(await lowStockAlerts(itemId)).toHaveLength(0)

      // Sellable 3: at the threshold
      await orderOne(getContainer(), shop, variantId)
      await movementsOf(itemId, 3)
      const [alert] = await lowStockAlerts(itemId)
      // Named by its product and variant, opening the product; never the item's id
      expect(alert?.data).toMatchObject({
        available: 3,
        threshold: 3,
        name: "uyari-kupa — Standart",
        product_id: productId,
        variant_id: variantId,
        title: "Düşük stok: uyari-kupa — Standart",
      })

      await orderOne(getContainer(), shop, variantId)
      await movementsOf(itemId, 4)
      expect(await lowStockAlerts(itemId)).toHaveLength(1)

      // Restocked above the line, then low again: a second alert
      await setLevel(itemId, 10)
      await movementsOf(itemId, 5)
      await setLevel(itemId, 5)
      await movementsOf(itemId, 6)
      expect(await alertsOf(itemId, 2)).toHaveLength(2)
    })

    it("does not alert for a deleted product's stock, at once or at night", async () => {
      const { productId, itemId } = await stockedProduct(getContainer(), shop, "silinen-kupa", 10)
      await movementsOf(itemId, 1)
      await armed(itemId)

      await settle(http.delete(`/admin/products/${productId}`, admin))
      // The nightly check reads deleted levels too: a deleted item's emptied level is no alert
      await stockReconcile(getContainer())
      expect(await alertsOf(itemId, 1)).toHaveLength(0)
    })

    it("alerts once when two orders take an item under the line together", async () => {
      const { variantId, itemId } = await stockedProduct(getContainer(), shop, "ayni-anda", 6)
      await armed(itemId)
      await Promise.all([
        orderOne(getContainer(), shop, variantId),
        orderOne(getContainer(), shop, variantId),
      ])
      const alerts = await alertsOf(itemId, 1)
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.data).toMatchObject({ threshold: 5 })
    })

    it("does not alert for an item made with little stock until it was above the line", async () => {
      const { itemId } = await stockedProduct(getContainer(), shop, "az-kupa", 2)
      await movementsOf(itemId, 1)
      expect(await alertsOf(itemId, 0)).toHaveLength(0)
      await setLevel(itemId, 10)
      await armed(itemId)
      await setLevel(itemId, 4)
      expect(await alertsOf(itemId, 1)).toHaveLength(1)
    })

    it("gives an item its own threshold over the shop's", async () => {
      const { itemId } = await stockedProduct(getContainer(), shop, "esik-kupa", 10)
      const saved = await post<{ watch: { threshold: number | null; fallback: number } }>(
        `/admin/stock-items/${itemId}/watch`,
        { threshold: 8 }
      )
      // The status first: a refusal then says what it was
      expect({ status: saved.status, body: saved.data }).toMatchObject({ status: 200 })
      expect(saved.data.watch).toMatchObject({ threshold: 8, fallback: 5 })
      // Raised over what is left: checked at once
      await armed(itemId)
      await post(`/admin/stock-items/${itemId}/watch`, { threshold: 12 })
      const [alert] = await alertsOf(itemId, 1)
      expect(alert?.data).toMatchObject({ available: 10, threshold: 12 })
      const { data } = await http.get<{ items: { id: string; threshold: number }[] }>(
        "/admin/stock-board?view=all",
        admin
      )
      expect(data.items.find((item) => item.id === itemId)?.threshold).toBe(12)
      const cleared = await post<{ watch: { threshold: number | null } }>(
        `/admin/stock-items/${itemId}/watch`,
        { threshold: null }
      )
      expect(cleared.data.watch.threshold).toBeNull()
    })

    it("opens each level's balance at deploy and writes what the events missed at night", async () => {
      const { itemId } = await stockedProduct(getContainer(), shop, "gece-kupa", 7)
      await movementsOf(itemId, 1)
      // A shop whose stock predates the ledger: the deploy's script opens each balance
      const knex = getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      await knex("stock_movement").where({ inventory_item_id: itemId }).del()
      await openingBalances({ container: getContainer(), args: [] })
      expect(await movementsOf(itemId, 1)).toEqual([
        expect.objectContaining({ reason: "reconcile", delta_stocked: 7, stocked_after: 7 }),
      ])

      // The first change after it is a change (7 → 4), and it crosses the threshold (5)
      await setLevel(itemId, 4)
      expect((await movementsOf(itemId, 2))[1]).toMatchObject({
        reason: "manual",
        delta_stocked: -3,
        stocked_after: 4,
      })
      expect(await lowStockAlerts(itemId)).toHaveLength(1)

      // Straight through the module, no event: the night's check writes it
      await getContainer()
        .resolve(Modules.INVENTORY)
        .updateInventoryLevels([
          { inventory_item_id: itemId, location_id: shop.locationId, stocked_quantity: 6 },
        ])
      await stockReconcile(getContainer())
      expect((await movementsOf(itemId, 3))[2]).toMatchObject({
        reason: "reconcile",
        delta_stocked: 2,
        stocked_after: 6,
      })
    })
  },
})

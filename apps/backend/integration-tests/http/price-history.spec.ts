import {
  createCustomerGroupsWorkflow,
  createPriceListsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PRICE_HISTORY_MODULE } from "../../src/modules/price-history"
import type PriceHistoryModuleService from "../../src/modules/price-history/service"
import { discountViewOf } from "../../src/workflows/pricing/discount-view"
import {
  recordAllSellingPrices,
  recordListBoundaries,
} from "../../src/workflows/pricing/price-history"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(240 * 1000)

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** F4.2 (ADR-0023): the selling price's history, from price events and the hourly check. */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    let shop: StockShop
    const history = () => getContainer().resolve<PriceHistoryModuleService>(PRICE_HISTORY_MODULE)

    // The variant's TRY records, once there are `count` of them (events arrive after the write)
    async function recordsOf(variantId: string, count: number) {
      let rows: Awaited<ReturnType<PriceHistoryModuleService["listPriceRecords"]>> = []
      for (let attempt = 0; attempt < 100; attempt++) {
        rows = await history().listPriceRecords(
          { variant_id: variantId, currency_code: "try" },
          { order: { seq: "ASC" } }
        )
        if (rows.length >= count) {
          return rows
        }
        await pause(100)
      }
      throw new Error(`${variantId} has ${String(rows.length)} records, not ${String(count)}`)
    }

    const setPrice = (variantId: string, amount: number) =>
      updateProductVariantsWorkflow(getContainer()).run({
        input: {
          product_variants: [{ id: variantId, prices: [{ currency_code: "try", amount }] }],
        },
      })

    const saleList = (variantId: string, amount: number, extra: Record<string, unknown> = {}) =>
      createPriceListsWorkflow(getContainer()).run({
        input: {
          price_lists_data: [
            {
              title: `İndirim ${String(amount)}`,
              description: "Kampanya",
              // A sale list (the default type): its price wins only where it is lower
              status: "active",
              prices: [{ variant_id: variantId, amount, currency_code: "try" }],
              ...extra,
            },
          ],
        },
      })

    beforeEach(async () => {
      shop = await stockShop(getContainer())
    })

    it("records a price and each change of it, a sale list's included", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "gecmis-kupa", 1)
      const [opened] = await recordsOf(variantId, 1)
      expect(opened).toMatchObject({ amount: 100, original_amount: 100, reason: "price_change" })

      await setPrice(variantId, 120)
      await recordsOf(variantId, 2)
      await saleList(variantId, 80)
      const rows = await recordsOf(variantId, 3)
      expect(rows.at(-1)).toMatchObject({
        amount: 80,
        original_amount: 120,
        reason: "price_change",
      })
      expect(rows.at(-1)?.price_list_id).toMatch(/^plist_/)

      // The price before the discount: the lowest of the 30 days before it began
      expect(await discountViewOf(getContainer(), variantId, "try")).toMatchObject({
        current: 8000,
        regular: 12000,
        discounted: true,
        before: 10000,
        basis: "history",
      })
    })

    it("leaves a customer group's price out, and finds a list that began on its own", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "zamanli-kupa", 1)
      await recordsOf(variantId, 1)
      const { result: groups } = await createCustomerGroupsWorkflow(getContainer()).run({
        input: { customersData: [{ name: "Toptan" }] },
      })
      await saleList(variantId, 50, { rules: { "customer.groups.id": [groups[0]?.id ?? ""] } })
      // Begins in a moment, with no event when it does
      await saleList(variantId, 70, { starts_at: new Date(Date.now() + 2000) })
      await pause(3000)
      expect(await history().lastPrices([variantId], ["try"])).toEqual([
        expect.objectContaining({ amount: "100" }),
      ])

      expect(await recordAllSellingPrices(getContainer(), "reconcile")).toBeGreaterThan(0)
      const rows = await recordsOf(variantId, 2)
      expect(rows.at(-1)).toMatchObject({ amount: 70, original_amount: 100, reason: "reconcile" })
      // Nothing new the second time
      const before = (await recordsOf(variantId, 2)).length
      await recordAllSellingPrices(getContainer(), "reconcile")
      expect((await recordsOf(variantId, before)).length).toBe(before)
    })

    it("records a list's start at the time it began, not at the next hourly check", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "sinir-kupa", 1)
      await recordsOf(variantId, 1)
      // Far enough ahead that a slow runner still creates the list before it starts (CI, 2026-10-27)
      const startsAt = new Date(Date.now() + 5000)
      await saleList(variantId, 60, { starts_at: startsAt })
      await pause(Math.max(0, startsAt.getTime() - Date.now()) + 1000)

      expect(await recordListBoundaries(getContainer())).toBeGreaterThan(0)
      const rows = await recordsOf(variantId, 2)
      expect(rows.at(-1)).toMatchObject({ amount: 60, reason: "price_change" })
      expect(new Date(rows.at(-1)?.recorded_at ?? 0).getTime()).toBe(startsAt.getTime())
      // The hourly check finds it already recorded
      await recordAllSellingPrices(getContainer(), "reconcile")
      expect((await recordsOf(variantId, 2)).length).toBe(2)
    })
  },
})

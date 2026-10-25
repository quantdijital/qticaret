import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedDemo } from "../../src/scripts/seed"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface Board {
  items: {
    id: string
    sku: string | null
    available: number
    levels: { location_id: string }[]
    variant: { product: { title: string } | null } | null
  }[]
  count: number
  counts: { all: number; low: number; out: number }
  threshold: number
}

interface LevelRow {
  inventory_item_id: string
  location_id: string
  inventory_item?: { sku?: string | null } | null
}

/** The panel's stock list (adr/0022): views by sellable stock, search, people only. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const get = (url: string) => settle(http.get<Board>(url, { headers: admin.headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("refuses an unknown view and anonymous requests", async () => {
      const bad = await get("/admin/stock-board?view=empty")
      const anonymous = await settle(http.get("/admin/stock-board"))

      expect(bad.status).toBe(400)
      expect(anonymous.status).toBe(401)
    })

    it("puts low and sold-out items in their views and searches by SKU", async () => {
      const container = getContainer()
      await seedDemo(container)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "inventory_level",
        fields: ["inventory_item_id", "location_id", "inventory_item.sku"],
      })
      const levels = data as unknown as LevelRow[]
      const [low, out] = levels
      if (!low || !out) {
        throw new Error("the demo has no stock levels")
      }
      const update = (row: LevelRow, stocked: number) => ({
        inventory_item_id: row.inventory_item_id,
        location_id: row.location_id,
        stocked_quantity: stocked,
      })
      await http.post(
        "/admin/inventory-items/location-levels/batch",
        { update: [update(low, 2), update(out, 0)] },
        { headers: admin.headers }
      )

      const all = await get("/admin/stock-board")
      const lowView = await get("/admin/stock-board?view=low")
      const outView = await get("/admin/stock-board?view=out")
      const sku = low.inventory_item?.sku ?? ""
      const search = await get(`/admin/stock-board?q=${encodeURIComponent(sku)}`)

      expect(all.status).toBe(200)
      expect(all.data.counts.all).toBe(levels.length)
      expect(lowView.data.counts).toMatchObject({ low: 2, out: 1 })
      // Emptiest first
      expect(lowView.data.items.map((item) => item.id)).toEqual([
        out.inventory_item_id,
        low.inventory_item_id,
      ])
      expect(outView.data.items[0]?.available).toBe(0)
      expect(outView.data.items[0]?.variant?.product?.title).toBeTruthy()
      expect(search.data.items.map((item) => item.sku)).toContain(sku)
      // The search narrows: an item with another SKU stays out
      expect(search.data.count).toBeLessThan(all.data.count)
      expect(search.data.items.every((item) => item.sku?.includes(sku))).toBe(true)
    })
  },
})

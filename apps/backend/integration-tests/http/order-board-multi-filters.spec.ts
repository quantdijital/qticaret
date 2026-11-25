import { readFileSync, rmSync } from "node:fs"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CSV_BOM } from "../../src/lib/security"
import { seedDemo } from "../../src/scripts/seed"
import { DEMO_SHIPPING_OPTIONS } from "../../src/scripts/seed/data"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import type { DemoStage } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

interface Board {
  orders: { id: string }[]
  count: number
  counts: Record<string, number>
}

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

async function firstId(container: MedusaContainer, entity: string, filters = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields: ["id"], filters })
  return (data[0] as { id: string } | undefined)?.id ?? ""
}

/**
 * The order list's filters with several choices at once (an order whose
 * parcel is not sent or on its way), as a comma list, a repeated parameter
 * or the export's array; a single value as older links have it still works.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }

    const get = (url: string) => settle(http.get<Board>(url, { headers: owner.headers }))
    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: owner.headers }))

    const shop = async () => {
      const container = getContainer()
      const { regionId, salesChannelId } = await seedDemo(container)
      const option = await firstId(container, "shipping_option", {
        name: DEMO_SHIPPING_OPTIONS[0].name,
      })
      const variant = await firstId(container, "product_variant")
      return async (stage: DemoStage, lastName: string) => {
        const orderId = await placeOrder(container, {
          regionId,
          salesChannelId,
          shippingOptionId: option,
          items: [{ variant_id: variant, quantity: 1 }],
          address: { first_name: "Elif", last_name: lastName, address_1: "Demo Sokak 3" },
        })
        await advanceOrder(container, orderId, stage)
        return orderId
      }
    }
    const settled = async (id: string): Promise<Job> => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, {
          headers: owner.headers,
        })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
    })

    afterAll(() => {
      for (const path of filesNamed(/siparisler-.*\.csv$/)) {
        rmSync(path, { force: true })
      }
    })

    it("lists the orders matching any of a filter's choices, and a single one as before", async () => {
      const place = await shop()
      const toShip = await place("to_ship", "Yıldız")
      const onTheWay = await place("shipped", "Aydın")
      const done = await place("delivered", "Koç")
      const ids = (board: { data: Board }) => board.data.orders.map((order) => order.id).sort()

      const single = await get("/admin/order-board?shipping=none")
      const comma = await get("/admin/order-board?shipping=none,on_the_way")
      const repeated = await get("/admin/order-board?shipping=none&shipping=on_the_way")
      const payments = await get("/admin/order-board?payment=paid,awaiting")
      const methods = await get("/admin/order-board?method=card,payment_link")
      const carriers = await get("/admin/order-board?carrier=aras,own")
      const together = await get("/admin/order-board?shipping=on_the_way,delivered&carrier=own")
      const unknown = await get("/admin/order-board?shipping=none,lost")

      expect(ids(single)).toEqual([toShip])
      expect(ids(comma)).toEqual([toShip, onTheWay].sort())
      expect(ids(repeated)).toEqual([toShip, onTheWay].sort())
      // The tabs count what the filters leave
      expect(comma.data.counts).toMatchObject({ all: 2, to_ship: 1, shipped: 1, delivered: 0 })
      expect(payments.data.count).toBe(3)
      // The demo pays with the system's provider and delivers with the shop's own options
      expect(methods.data.count).toBe(0)
      expect(carriers.data.count).toBe(3)
      expect(ids(together)).toEqual([onTheWay, done].sort())
      expect(unknown.status).toBe(400)
    })

    it("exports the orders matching any of a filter's choices", async () => {
      const place = await shop()
      await place("to_ship", "Yıldız")
      await place("shipped", "Aydın")
      await place("delivered", "Koç")

      const several = await post<{ async_job: Job }>("/admin/order-board/export", {
        shipping: ["none", "delivered"],
        format: "csv",
      })
      const single = await post<{ async_job: Job }>("/admin/order-board/export", {
        shipping: "on_the_way",
        format: "csv",
      })
      const unknown = await post("/admin/order-board/export", { carrier: ["own", "mng"] })
      const manyJob = await settled(several.data.async_job.id)
      const singleJob = await settled(single.data.async_job.id)
      const result = await http.get<{ url: string }>(`/admin/async-jobs/${manyJob.id}/result`, {
        headers: owner.headers,
      })
      const path = filesNamed(/siparisler-.*\.csv$/).find((file) =>
        result.data.url.endsWith(file.split("/").pop() ?? "")
      )
      const text = readFileSync(path ?? "", "utf8").slice(CSV_BOM.length)

      expect(several.status).toBe(202)
      expect(manyJob).toMatchObject({ status: "succeeded", result_summary: { orders: 2 } })
      expect(singleJob).toMatchObject({ status: "succeeded", result_summary: { orders: 1 } })
      expect(text).toContain("Yıldız")
      expect(text).toContain("Koç")
      expect(text).not.toContain("Aydın")
      expect(unknown.status).toBe(400)
    })
  },
})

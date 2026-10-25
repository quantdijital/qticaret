import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"

jest.setTimeout(120 * 1000)

/** docs/17: the home page's order numbers, without personal data. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("answers zeros for a shop without orders, and only numbers", async () => {
      const admin = await createAdminUser(http, getContainer())

      const { status, data } = await http.get("/admin/home/summary", { headers: admin.headers })

      expect(status).toBe(200)
      expect(data).toEqual({
        open_orders: 0,
        awaiting_shipment: 0,
        capped: false,
        today: { orders: 0, sales: [], capped: false },
      })
    })
  },
})

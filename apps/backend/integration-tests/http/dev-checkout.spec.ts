import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(60 * 1000)

/** adr/0028: the payment test page exists on a developer's machine only. */
medusaIntegrationTestRunner({
  testSuite: ({ api }) => {
    const http = api as HttpClient

    it("answers 404 outside development, for the page and its order lookup", async () => {
      const page = await settle(http.get("/dev/checkout"))
      const order = await settle(http.get("/dev/checkout/order?cart_id=cart_123"))

      expect(page.status).toBe(404)
      expect(order.status).toBe(404)
      expect(JSON.stringify(page.data)).not.toMatch(/pk_|publishable/i)
    })
  },
})

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(60 * 1000)

/**
 * adr/0028: the storefront's demo key lookup exists on a developer's
 * machine only (adr/0046 §13); the payment test page is gone (F18 D7).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api }) => {
    const http = api as HttpClient

    it("has no payment test page any more", async () => {
      const page = await settle(http.get("/dev/checkout"))
      const order = await settle(http.get("/dev/checkout/order?cart_id=cart_123"))

      expect(page.status).toBe(404)
      expect(order.status).toBe(404)
      expect(JSON.stringify(page.data)).not.toMatch(/pk_|publishable/i)
    })

    it("answers 404 for the storefront's demo key outside development", async () => {
      const key = await settle(http.get("/dev/storefront-key"))

      expect(key.status).toBe(404)
      expect(JSON.stringify(key.data)).not.toMatch(/pk_/)
    })
  },
})

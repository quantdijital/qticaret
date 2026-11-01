import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(60 * 1000)

/**
 * adr/0028: the payment test page exists on a developer's machine only; so
 * does the storefront's demo key lookup (adr/0046 §13).
 */
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

    it("answers 404 for the storefront's demo key outside development", async () => {
      const key = await settle(http.get("/dev/storefront-key"))

      expect(key.status).toBe(404)
      expect(JSON.stringify(key.data)).not.toMatch(/pk_/)
    })
  },
})

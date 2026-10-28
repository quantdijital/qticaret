import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

// Read once the app starts; off by default in tests. Only reserved names
// below, which the check refuses without asking DNS
process.env["EMAIL_DOMAIN_CHECK"] = "on"

jest.setTimeout(120 * 1000)

const REFUSED = "messaging.email_domain_refuses"

/** F10 M9: an address whose domain takes no mail is refused where the shop would mail it. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront

    const post = (
      path: string,
      body: unknown,
      headers: Record<string, string> = storefront.headers
    ) => settle(http.post<{ message?: string; cart?: { id: string } }>(path, body, { headers }))

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
    })

    it("opens no account for an address whose domain takes no mail", async () => {
      const registration = await post(
        "/auth/customer/emailpass/register",
        { email: `ayse-${randomUUID()}@magaza.invalid`, password: randomUUID() },
        {}
      )

      expect(registration.status).toBe(400)
      expect(registration.data.message).toBe(REFUSED)
    })

    it("takes no such address for a guest's cart, at its start or later", async () => {
      const refused = await post("/store/carts", {
        region_id: shop.regionId,
        email: "misafir@yanlis.invalid",
      })
      const cart = await post("/store/carts", { region_id: shop.regionId })
      const cartId = cart.data.cart?.id ?? ""
      const changed = await post(`/store/carts/${cartId}`, { email: "misafir@magaza.test" })
      // Server-only metadata stays the server's on the cart itself too
      const marked = await post(`/store/carts/${cartId}`, { metadata: { qt_sms_held: false } })

      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe(REFUSED)
      expect(cart.status).toBe(200)
      expect(changed.data.message).toBe(REFUSED)
      expect(marked.data.message).toBe("cart.metadata_reserved")
    })

    it("takes no such address for a stock alert", async () => {
      const alert = await post("/store/stock-alerts", {
        variant_id: "variant_01ABCDEFGHJKMNPQRSTVWXYZ00",
        email: "bekleyen@stok.invalid",
      })

      expect(alert.status).toBe(400)
      expect(alert.data.message).toBe(REFUSED)
    })
  },
})

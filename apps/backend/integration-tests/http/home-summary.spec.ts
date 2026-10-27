import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { connectPaytr, notifyPaytr, readyCart, startPaytrPayment } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()

/** docs/17: the home page's order numbers, without personal data. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      process.env["PAYTR_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      await fake.close()
    })

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

    // F2 left this until carts could be paid (F5): a paid order waits to be shipped
    it("counts a paid order as open and waiting to be shipped, and today's sale", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      const admin = await connectPaytr(http, container, account)
      const cartId = await readyCart(container, shop, cup.variantId)
      const reference = await startPaytrPayment(http, storefront.headers, cartId)
      await notifyPaytr(http, fake.pay(reference))

      const { data } = await http.get("/admin/home/summary", { headers: admin.headers })

      expect(data).toEqual({
        open_orders: 1,
        awaiting_shipment: 1,
        capped: false,
        today: { orders: 1, sales: [{ currency_code: "try", amount: "210.00" }], capped: false },
      })
    })
  },
})

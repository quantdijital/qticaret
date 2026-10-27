import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { forgetPaytrInstallmentRates } from "../../src/lib/payments/paytr"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { connectPaytr, readyCart, startPaytrPayment } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()

interface Table {
  enabled: boolean
  amount: string
  max_count: number
  families: { family: string; options: { count: number; rate: number; total: string }[] }[]
}

/** F5 V6: installments, as the shop chooses and as PayTR prices them. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    const table = (query: string) =>
      settle(
        http.get<{ installments: Table }>(`/store/payment/installments?${query}`, {
          headers: storefront.headers,
        })
      )
    const choose = (settings: Record<string, unknown>) =>
      http.post("/admin/platform-settings/payments", settings, { headers: admin.headers })
    const rateRequests = () =>
      fake.requests.filter((request) => request.path === "/odeme/taksit-oranlari")

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      // Read on the first PayTR call (lib/payments/paytr/client.ts)
      process.env["PAYTR_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await connectPaytr(http, container, account)
      forgetPaytrInstallmentRates()
      fake.requests.length = 0
    })

    it("prices a product's installments with PayTR's rates, asking PayTR once", async () => {
      const first = await table(`variant_id=${variantId}&region_id=${shop.regionId}`)
      const again = await table(`variant_id=${variantId}&region_id=${shop.regionId}`)

      expect(first.data.installments).toMatchObject({
        enabled: true,
        amount: "120.00",
        max_count: 12,
      })
      const bonus = first.data.installments.families.find(({ family }) => family === "bonus")
      expect(bonus?.options.map(({ count, total }) => [count, total])).toEqual([
        [1, "120.00"],
        [2, "124.19"],
        [3, "125.63"],
        [6, "129.95"],
        [12, "139.08"],
      ])
      expect(again.data).toEqual(first.data)
      expect(rateRequests()).toHaveLength(1)
    })

    it("offers no more than the shop chose, and one payment when it turned them off", async () => {
      await choose({ max_installment: 3 })
      const three = await table(`variant_id=${variantId}&region_id=${shop.regionId}`)
      await choose({ installments_enabled: false })
      const off = await table(`variant_id=${variantId}&region_id=${shop.regionId}`)

      expect(three.data.installments.max_count).toBe(3)
      expect(
        three.data.installments.families.flatMap(({ options }) => options.map(({ count }) => count))
      ).not.toContain(6)
      expect(off.data.installments).toMatchObject({ enabled: false, families: [] })
    })

    it("prices a cart from its total, and tells PayTR the shop's limit when paying", async () => {
      await choose({ max_installment: 6 })
      const cartId = await readyCart(getContainer(), shop, variantId)

      const cart = await table(`cart_id=${cartId}`)
      await startPaytrPayment(http, storefront.headers, cartId)
      const token = fake.requests.find((request) => request.path === "/odeme/api/get-token")

      expect(cart.data.installments).toMatchObject({ amount: "210.00", max_count: 6 })
      expect(token?.fields).toMatchObject({ max_installment: "6", no_installment: "0" })
    })

    it("answers nothing for a product or a cart the storefront cannot see", async () => {
      const unknown = await table(`variant_id=variant_nope&region_id=${shop.regionId}`)
      const both = await table(`cart_id=cart_x&variant_id=${variantId}`)

      expect(unknown.status).toBe(404)
      expect(both.status).toBe(400)
    })
  },
})

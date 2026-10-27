import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { reconcilePaytrSessions } from "../../src/jobs/paytr-reconcile"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import type { HttpClient } from "../helpers/http"
import { connectPaytr, orderOfCart, readyCart, storeReturnUrls } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()

/**
 * adr/0028: the fake PayTR's clickable form, which the payment test page
 * shows, notifies the real backend as PayTR would.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string

    /** The cart's form address and PayTR's reference, as the storefront receives them. */
    const startForm = async (cartId: string) => {
      const started = await http.post<{ payment_session: { data: Record<string, string> } }>(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: PAYTR_PAYMENT_PROVIDER_ID, return_urls: storeReturnUrls() },
        { headers: storefront.headers }
      )
      const { form_url: url = "", merchant_oid: reference = "" } = started.data.payment_session.data
      return { url, reference }
    }
    const choose = (url: string, fields: Record<string, string>) =>
      fetch(url, { method: "POST", body: new URLSearchParams(fields), redirect: "manual" })

    beforeAll(async () => {
      const backend = (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
      fake = await startFakePaytr(account, { notifyUrl: `${backend}/hooks/paytr` })
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
      await connectPaytr(http, container, account)
    })

    it("places the order from the form's notification, with the installments' surcharge", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const form = await startForm(cartId)

      const page = await (await fetch(form.url)).text()
      const paid = await choose(form.url, { outcome: "success", installments: "3" })
      const again = await (await choose(form.url, { outcome: "failed" })).text()

      expect(page).toContain("Ödemeyi onayla")
      expect(paid.status).toBe(303)
      expect(paid.headers.get("location")).toBe(storeReturnUrls().success)
      expect(await orderOfCart(getContainer(), cartId)).toMatch(/^order_/)
      expect(fake.payments.get(form.reference)).toMatchObject({
        status: "success",
        installments: 3,
        notified: true,
        paymentAmount: 21000,
        totalAmount: 21985,
      })
      // A paid form only says so: a second post changes nothing
      expect(again).toContain("Bu ödeme sonuçlandı")
    })

    it("sends a refused card back to the failure address, the cart still open", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const form = await startForm(cartId)

      const refused = await choose(form.url, { outcome: "failed" })

      expect(refused.headers.get("location")).toBe(storeReturnUrls().failure)
      expect(fake.payments.get(form.reference)).toMatchObject({ status: "failed", notified: true })
      expect(await orderOfCart(getContainer(), cartId)).toBeNull()
    })

    it("loses the notification when asked; the shop finds the payment by asking PayTR", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const form = await startForm(cartId)

      await choose(form.url, { outcome: "silent" })
      const before = await orderOfCart(getContainer(), cartId)
      const placed = await reconcilePaytrSessions(getContainer(), { quietMs: 0 })

      expect(before).toBeNull()
      expect(fake.payments.get(form.reference)).toMatchObject({
        status: "success",
        notified: false,
      })
      expect(placed).toBe(1)
      expect(await orderOfCart(getContainer(), cartId)).toMatch(/^order_/)
    })
  },
})

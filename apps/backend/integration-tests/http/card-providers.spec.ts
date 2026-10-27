import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  fakeIyzicoAccount,
  fakePaytrAccount,
  startFakeIyzico,
  startFakePaytr,
} from "@qticaret/testing"
import type { FakeIyzico, FakePaytr } from "@qticaret/testing"
import { forgetIntegrationHealth } from "../../src/lib/integrations/health"
import { forgetPaytrInstallmentRates } from "../../src/lib/payments/paytr"
import type { HttpClient } from "../helpers/http"
import { postIyzicoCallback, startIyzicoPayment } from "../helpers/iyzico"
import { connectPaytr, orderOfCart, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

// Made-up accounts, fresh per run; the fake servers check every signature with them
const paytrAccount = fakePaytrAccount()
const iyzicoAccount = fakeIyzicoAccount()

interface Table {
  enabled: boolean
  max_count: number
  families: { family: string; options: { count: number; total: string }[] }[]
}

/** F5 V10: the card providers a storefront offers, the shop's choice first, and whose table it shows. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let paytr: FakePaytr
    let iyzico: FakeIyzico
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    const methods = async () =>
      (
        await http.get<{ card_providers: string[] }>("/store/payment/methods", {
          headers: storefront.headers,
        })
      ).data.card_providers
    const choose = (settings: Record<string, unknown>) =>
      http.post("/admin/platform-settings/payments", settings, { headers: admin.headers })
    const connectIyzico = () =>
      http.post(
        "/admin/integrations/credentials/iyzico",
        {
          settings: { test_mode: true },
          secrets: { api_key: iyzicoAccount.apiKey, secret_key: iyzicoAccount.secretKey },
        },
        { headers: admin.headers }
      )

    beforeAll(async () => {
      paytr = await startFakePaytr(paytrAccount)
      iyzico = await startFakeIyzico(iyzicoAccount)
      process.env["PAYTR_BASE_URL"] = paytr.url
      process.env["IYZICO_BASE_URL"] = iyzico.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      delete process.env["IYZICO_BASE_URL"]
      await Promise.all([paytr.close(), iyzico.close()])
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await connectPaytr(http, container, paytrAccount)
      forgetPaytrInstallmentRates()
      forgetIntegrationHealth()
    })

    it("offers the connected card providers only, the shop's choice first", async () => {
      const paytrOnly = await methods()
      await connectIyzico()
      const both = await methods()
      await choose({ card_provider: "iyzico" })
      const iyzicoFirst = await methods()

      expect(paytrOnly).toEqual(["pp_paytr_paytr"])
      expect(both).toEqual(["pp_paytr_paytr", "pp_iyzico_iyzico"])
      expect(iyzicoFirst).toEqual(["pp_iyzico_iyzico", "pp_paytr_paytr"])
    })

    it("puts a provider found down behind the backup, and the checkout completes with it", async () => {
      await connectIyzico()
      await choose({ card_provider: "paytr" })
      forgetIntegrationHealth()
      const healthy = await methods()
      // PayTR stops answering: the integrations health check finds it down
      for (let attempt = 0; attempt < 6; attempt += 1) {
        paytr.queue("/odeme/durum-sorgu", { drop: true })
      }
      forgetIntegrationHealth()
      const { data: routed } = await http.get<{
        card_providers: string[]
        card_providers_down: string[]
      }>("/store/payment/methods", { headers: storefront.headers })
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      iyzico.pay(started.token)
      await postIyzicoCallback(base(), started.sessionId, started.token, iyzicoAccount.secretKey)

      expect(healthy).toEqual(["pp_paytr_paytr", "pp_iyzico_iyzico"])
      expect(routed).toEqual({
        card_providers: ["pp_iyzico_iyzico", "pp_paytr_paytr"],
        card_providers_down: ["pp_paytr_paytr"],
        bank_transfer: null,
        cash_on_delivery: null,
      })
      expect(await orderOfCart(getContainer(), cartId)).toMatch(/^order_/)
    })

    it("shows iyzico's own totals when iyzico comes first, up to the shop's limit", async () => {
      await connectIyzico()
      await choose({ card_provider: "iyzico", max_installment: 6 })

      const { data } = await http.get<{ installments: Table }>(
        `/store/payment/installments?variant_id=${variantId}&region_id=${shop.regionId}`,
        { headers: storefront.headers }
      )

      expect(data.installments).toMatchObject({ enabled: true, max_count: 6 })
      expect(data.installments.families.map(({ family }) => family)).toEqual(["bonus", "world"])
      expect(
        data.installments.families[0]?.options.map(({ count, total }) => [count, total])
      ).toEqual([
        [1, "120.00"],
        [2, "122.40"],
        [3, "123.60"],
        [6, "127.20"],
      ])
      // PayTR was not asked: its rates price nothing here
      expect(paytr.requests.filter(({ path }) => path === "/odeme/taksit-oranlari")).toHaveLength(0)
    })
  },
})

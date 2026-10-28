import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { updateInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { BACK_IN_STOCK_MODULE } from "../../src/modules/back-in-stock"
import type BackInStockModuleService from "../../src/modules/back-in-stock/service"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** F10.5 (adr/0037 §4, KK2): stock coming in tells each waiting customer once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let itemId: string
    let productId: string
    const MAIL_ENV = [
      "EMAIL_TRANSPORT",
      "RESEND_API_KEY",
      "RESEND_BASE_URL",
      "EMAIL_FROM",
      "BACKEND_URL",
    ]
    const saved: Record<string, string | undefined> = {}

    const ask = (
      body: Record<string, string>,
      headers: Record<string, string> = storefront.headers
    ) =>
      settle(
        http.post<{ status?: string; message?: string }>("/store/stock-alerts", body, { headers })
      )
    const mailsTo = (email: string, template: string) =>
      fake.messages.filter((mail) => mail.to.includes(email) && mail.template === template)
    const setLevel = (stocked: number) =>
      updateInventoryLevelsWorkflow(getContainer()).run({
        input: {
          updates: [
            { inventory_item_id: itemId, location_id: shop.locationId, stocked_quantity: stocked },
          ],
        },
      })

    beforeAll(async () => {
      fake = await startFakeMail()
      for (const name of MAIL_ENV) {
        saved[name] = process.env[name]
      }
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
        BACKEND_URL: "https://api.magaza.example",
      })
    })

    afterAll(async () => {
      for (const name of MAIL_ENV) {
        if (saved[name] === undefined) {
          Reflect.deleteProperty(process.env, name)
        } else {
          process.env[name] = saved[name]
        }
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      ;({ variantId, itemId, productId } = await stockedProduct(
        container,
        shop,
        `fincan-${String(Date.now())}`,
        0,
        180
      ))
    })

    it("tells a customer and a confirmed guest once when stock comes in, an unconfirmed guest never", async () => {
      const customer = await registerCustomer(http, storefront)
      const guest = `stok-${String(Date.now())}@example.com`
      const silent = `onaysiz-${String(Date.now())}@example.com`

      const own = await ask({ variant_id: variantId }, customer.headers)
      const pending = await ask({ variant_id: variantId, email: guest })
      await ask({ variant_id: variantId, email: silent })
      const [confirmMail] = await eventually(
        () => Promise.resolve(mailsTo(guest, "stock_alert_confirm")),
        (found) => found.length > 0
      )
      const link = new URL(
        /href="([^"]+stock-alerts\/confirm[^"]+)"/
          .exec(confirmMail?.html ?? "")?.[1]
          ?.replaceAll("&amp;", "&") ?? "https://none.example"
      )
      const page = await settle(
        http.get<string>(`${link.pathname}${link.search}`, { responseType: "text" })
      )
      const confirmed = await settle(http.post<string>(`${link.pathname}${link.search}`, ""))
      const reused = await settle(http.post<string>(`${link.pathname}${link.search}`, ""))

      await setLevel(5)
      await eventually(
        () =>
          Promise.resolve([
            ...mailsTo(customer.email, "stock_back_in_stock"),
            ...mailsTo(guest, "stock_back_in_stock"),
          ]),
        (found) => found.length === 2
      )
      // More stock later tells no one again
      await setLevel(6)
      await pause(1500)

      expect(own.data.status).toBe("active")
      expect(pending.data.status).toBe("pending")
      expect(link.origin).toBe("https://api.magaza.example")
      expect(page.data).toContain("Bildirimi onayla")
      expect(confirmed.status).toBe(200)
      expect(reused.status).toBe(400)
      expect(mailsTo(customer.email, "stock_back_in_stock")).toHaveLength(1)
      expect(mailsTo(guest, "stock_back_in_stock")).toHaveLength(1)
      expect(mailsTo(silent, "stock_back_in_stock")).toHaveLength(0)
      expect(mailsTo(guest, "stock_back_in_stock")[0]?.subject).toMatch(/yeniden stokta$/)
    })

    it("takes no alert for a variant in stock or not tracked, and keeps no address in the clear", async () => {
      // A fresh address each run: the per-address limit outlives a run in Redis
      const asker = `var-${String(Date.now())}@example.com`
      const secret = `gizli-${String(Date.now())}@example.com`
      await setLevel(3)
      const inStock = await ask({ variant_id: variantId, email: asker })
      const unknown = await ask({ variant_id: "variant_01UNKNOWN", email: asker })
      const noEmail = await ask({ variant_id: variantId })
      await setLevel(0)
      await ask({ variant_id: variantId, email: secret })
      const rows = await getContainer()
        .resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE)
        .listStockAlerts({ variant_id: variantId })

      const admin = await createAdminUser(http, getContainer())
      const { data: interest } = await http.get<{
        wishlist: number
        stock_alerts: { variant_id: string; waiting: number }[]
      }>(`/admin/products/${productId}/interest`, { headers: admin.headers })

      // A guest's alert counts once it is confirmed
      expect(interest.stock_alerts).toEqual([])
      expect(inStock.data.message).toBe("stock_alerts.in_stock")
      expect(unknown.data.message).toBe("stock_alerts.not_tracked")
      expect(noEmail.status).toBe(400)
      expect(rows).toHaveLength(1)
      expect(JSON.stringify(rows)).not.toContain(secret)
      expect(rows[0]?.email_masked).toBe(`gi***@example.com`)
    })
  },
})

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { loadOrderMessage } from "../../src/workflows/messaging/loaders/order"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface OrderBody {
  order?: { id: string }
  message?: string
}

/**
 * F10.1 (adr/0037 §2): an order opens to its own signed-in customer, or to
 * a guest holding the key from its e-mail or its cart; its id alone opens
 * nothing.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let customer: TestCustomer
    let variantId: string

    const guestOrder = (email = `misafir-${String(Date.now())}@example.com`) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email,
      })
    const read = (orderId: string, headers: Record<string, string> = {}) =>
      settle(
        http.get<OrderBody>(`/store/orders/${orderId}`, {
          headers: { ...storefront.headers, ...headers },
        })
      )
    const cartOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["cart.id"], filters: { id: orderId } })
      return (data[0] as { cart: { id: string } }).cart.id
    }
    const keyOf = async (orderId: string) => {
      const { data } = await http.post<{ order_id: string; token: string }>(
        `/store/carts/${await cartOf(orderId)}/order-access`,
        {},
        { headers: storefront.headers }
      )
      return data
    }

    let fake: FakeMail
    const MAIL_ENV = ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of MAIL_ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      customer = await registerCustomer(http, storefront)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120))
        .variantId
    })

    it("opens a guest's order with its key only, its own and no other", async () => {
      const orderId = await guestOrder()
      const otherId = await guestOrder()
      const key = await keyOf(orderId)
      const otherKey = await keyOf(otherId)

      const bare = await read(orderId)
      const opened = await read(orderId, { "x-order-token": key.token })
      const crossed = await read(orderId, { "x-order-token": otherKey.token })
      const signedInStranger = await read(orderId, customer.headers)

      expect(key.order_id).toBe(orderId)
      expect(bare.status).toBe(404)
      expect(opened.status).toBe(200)
      expect(opened.data.order?.id).toBe(orderId)
      expect(crossed.status).toBe(404)
      expect(signedInStranger.status).toBe(404)
    })

    it("opens a customer's order to them signed in, without a key", async () => {
      const orderId = await guestOrder(customer.email)
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id })

      const own = await read(orderId, customer.headers)

      expect(own.status).toBe(200)
    })

    it("gives another signed-in customer nothing through Medusa's order transfer", async () => {
      const orderId = await guestOrder()
      const transfer = (step: string) =>
        settle(
          http.post<OrderBody>(
            `/store/orders/${orderId}/transfer/${step}`,
            step === "request" ? {} : { token: "x".repeat(32) },
            { headers: { ...storefront.headers, ...customer.headers } }
          )
        )

      const answers = await Promise.all(
        ["request", "accept", "decline", "cancel"].map((step) => transfer(step))
      )

      expect(answers.map(({ status }) => status)).toEqual([404, 404, 404, 404])
      expect(answers.every(({ data }) => data.order === undefined)).toBe(true)
    })

    it("hands the key out from the cart for a day only", async () => {
      const orderId = await guestOrder()
      const cartId = await cartOf(orderId)
      await getContainer()
        .resolve(Modules.CART)
        .updateCarts(cartId, { completed_at: new Date(Date.now() - 25 * 60 * 60 * 1000) })

      const late = await settle(
        http.post(`/store/carts/${cartId}/order-access`, {}, { headers: storefront.headers })
      )

      expect(late.status).toBe(404)
    })

    it("links the order's e-mail to its page with a key that opens it", async () => {
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const orderId = await guestOrder()

      const loaded = await loadOrderMessage(getContainer(), orderId)
      const url = new URL(loaded?.vars.orderUrl ?? "https://none.example")
      const opened = await read(orderId, { "x-order-token": url.searchParams.get("token") ?? "" })

      expect(url.origin).toBe("https://magaza.example.com")
      expect(url.pathname).toBe(`/siparis/${orderId}`)
      expect(opened.status).toBe(200)
    })

    it("mails the order's link to its own address when asked, and tells the asker nothing", async () => {
      await getContainer()
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      const email = `bul-${String(Date.now())}@example.com`
      const orderId = await guestOrder(email)
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["display_id"], filters: { id: orderId } })
      const displayId = Number(data[0]?.display_id)
      const ask = (address: string) =>
        settle(
          http.post(
            "/store/order-lookup",
            { display_id: displayId, email: address },
            { headers: storefront.headers }
          )
        )
      const links = () =>
        fake.messages.filter(
          ({ to, template }) => to.includes(email) && template === "order_access_link"
        )

      // A fresh stranger each run: the per-address limit outlives a run in Redis
      const stranger = `baskasi-${String(Date.now())}@example.com`
      const wrong = await ask(stranger)
      const right = await ask(email.toUpperCase())
      const [mail] = await eventually(
        () => Promise.resolve(links()),
        (found) => found.length > 0
      )
      const href = /href="([^"]+\/siparis\/[^"]+)"/.exec(mail?.html ?? "")?.[1] ?? ""
      const token = new URL(href.replaceAll("&amp;", "&")).searchParams.get("token") ?? ""
      const opened = await read(orderId, { "x-order-token": token })

      expect([wrong.status, right.status]).toEqual([202, 202])
      expect(wrong.data).toEqual(right.data)
      expect(fake.messages.some(({ to }) => to.includes(stranger))).toBe(false)
      expect(links()).toHaveLength(1)
      expect(opened.status).toBe(200)
    })

    it("brings a shopper's guest orders into the account they open with the address", async () => {
      const email = `ali_veli-${String(Date.now())}@example.com`
      // `_` is a wildcard to ILIKE: this address must not be taken for that one
      const lookalike = email.replace("_", "x")
      const own = await guestOrder(email.toUpperCase())
      const other = await guestOrder(lookalike)
      const account = await registerCustomer(http, storefront, email)

      const { data } = await http.get<{ orders: { id: string }[] }>("/store/orders", {
        headers: account.headers,
      })
      const ids = data.orders.map(({ id }) => id)
      const opened = await read(own, account.headers)

      expect(ids).toContain(own)
      expect(ids).not.toContain(other)
      expect(opened.status).toBe(200)
    })

    it("lets a guest cancel with the key, and no one with the id alone", async () => {
      const orderId = await guestOrder()
      const key = await keyOf(orderId)
      const cancel = (headers: Record<string, string>) =>
        settle(
          http.post<{ canceled?: boolean }>(
            `/store/orders/${orderId}/cancel`,
            {},
            { headers: { ...storefront.headers, ...headers } }
          )
        )

      const bare = await cancel({})
      const canceled = await cancel({ "x-order-token": key.token })

      expect(bare.status).toBe(404)
      expect(canceled.data).toMatchObject({ canceled: true })
    })
  },
})

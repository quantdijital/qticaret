import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, paytrNotification, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import { PAYMENT_RECOVERY_MODULE } from "../../src/modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../src/modules/payment-recovery/service"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import {
  connectPaytr,
  notifyPaytr,
  orderOfCart,
  readyCart,
  startPaytrPayment,
  storeReturnUrls,
} from "../helpers/paytr"
import { orderOne, stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const account = fakePaytrAccount()

/**
 * adr/0026 Ek 2026-11-06: a paid cart always becomes an order. The last
 * unit taken by another order between the payment's start and PayTR's
 * notice: the order is placed short of stock, marked, the shop told,
 * PayTR answered "OK". A busy database is tried again. The payment is not
 * started for a unit already gone.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let itemId: string
    // The line's name as the shop reads it: the product, then its option
    let lineTitle: string

    const success = (merchantOid: string) =>
      paytrNotification(account, {
        merchantOid,
        status: "success",
        paymentAmount: 21000,
        testMode: true,
      })
    const orderRow = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["id", "display_id", "metadata", "items.id"],
          filters: { id: orderId },
        })
      return data[0] as {
        id: string
        display_id: number
        metadata: Record<string, unknown> | null
        items: { id: string }[]
      }
    }
    const variantRow = async () => {
      const [variant] = await getContainer()
        .resolve(Modules.PRODUCT)
        .listProductVariants({ id: variantId }, { select: ["allow_backorder"] })
      return variant
    }
    const shopAlerts = (orderId: string) =>
      getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed", resource_id: orderId }, { select: ["data"] })

    beforeAll(async () => {
      fake = await startFakePaytr(account)
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
      // One on the shelf, 210 lira with shipping as PayTR's notification says
      const handle = `kupa-${String(Date.now())}`
      const cup = await stockedProduct(container, shop, handle, 1, 120)
      lineTitle = `${handle} / Standart`
      variantId = cup.variantId
      itemId = cup.itemId
      await connectPaytr(http, container, account)
    })

    it("places the order the shelf ran out of, marks it short and tells the shop", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const merchantOid = await startPaytrPayment(http, storefront.headers, cartId)
      // Another shopper's order takes the last unit while the card form is open
      await orderOne(container, shop, variantId)
      fake.pay(merchantOid)

      const answer = await notifyPaytr(http, success(merchantOid))
      const orderId = await orderOfCart(container, cartId)
      const order = await orderRow(orderId ?? "")
      const held = await container
        .resolve(Modules.INVENTORY)
        .listReservationItems({ line_item_id: order.items.map((item) => item.id) })
      const alerts = await eventually(
        () => shopAlerts(order.id),
        (rows) => rows.length > 0
      )
      const access = await settle(
        http.post(`/store/carts/${cartId}/order-access`, {}, { headers: storefront.headers })
      )

      expect(answer.status).toBe(200)
      expect(answer.data).toBe("OK")
      expect(order.metadata?.["stock_short"]).toMatchObject({
        lines: [{ variant_id: variantId, quantity: 1, short: 1 }],
      })
      // Held past the shelf, at the warehouse: shipping finds it reserved
      expect(held).toEqual([
        expect.objectContaining({ inventory_item_id: itemId, location_id: shop.locationId }),
      ])
      expect(Number(held[0]?.quantity)).toBe(1)
      // The variant sold past the shelf for this order only
      expect((await variantRow())?.allow_backorder).toBe(false)
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.data).toMatchObject({
        kind: "stock_short",
        order_id: order.id,
        number: String(order.display_id),
        lines: [{ title: lineTitle, short: 1 }],
        title: `Stok yetersiz sipariş #${String(order.display_id)}`,
      })
      expect(access.status).toBe(200)
    })

    it("answers PayTR with no OK while the database is busy, and places it on the next notice", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const merchantOid = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(merchantOid)
      const inventory = container.resolve(Modules.INVENTORY)
      const busy = jest
        .spyOn(inventory, "createReservationItems")
        .mockRejectedValueOnce(
          new Error("Knex: Timeout acquiring a connection. The pool is probably full.")
        )

      const first = await notifyPaytr(http, success(merchantOid))
      const between = await orderOfCart(container, cartId)
      busy.mockRestore()
      const second = await notifyPaytr(http, success(merchantOid))
      const order = await orderOfCart(container, cartId)

      expect(first.status).toBe(503)
      expect(first.data).not.toBe("OK")
      expect(between).toBeNull()
      expect(second.data).toBe("OK")
      expect(order).toMatch(/^order_/)
      expect((await orderRow(order ?? "")).metadata?.["stock_short"]).toBeUndefined()
    })

    it("does not start a payment for a unit another order took, unless it sells past the shelf", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      await orderOne(container, shop, variantId)
      const start = () =>
        settle(
          http.post(
            `/store/carts/${cartId}/payment-session`,
            { provider_id: PAYTR_PAYMENT_PROVIDER_ID, return_urls: storeReturnUrls() },
            { headers: storefront.headers }
          )
        )

      const stock = () =>
        http.get<{ short: unknown[] }>(`/store/carts/${cartId}/stock`, {
          headers: storefront.headers,
        })

      const seen = await stock()
      const refused = await start()
      await updateProductVariantsWorkflow(container).run({
        input: { selector: { id: variantId }, update: { allow_backorder: true } },
      })
      const backordered = await start()

      // What checkout's entry reads: the line and how many the shelf lacks
      expect(seen.data.short).toEqual([{ title: lineTitle, quantity: 1, short: 1 }])
      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({
        message: "cart.out_of_stock",
        values: { name: lineTitle },
      })
      expect(backordered.status).toBe(200)
      expect((await stock()).data.short).toEqual([])
    })

    it("tells the waiting page a payment that became no order is being given back", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const ask = () =>
        settle(
          http.post(`/store/carts/${cartId}/order-access`, {}, { headers: storefront.headers })
        )

      const waiting = await ask()
      await container.resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE).recordOrphan({
        provider: "paytr",
        reference: `payses${String(Date.now())}`,
        reason: "completion_failed",
        amount: 21000,
        currency_code: "try",
        test_mode: true,
        cart_id: cartId,
      })
      const refunding = await ask()

      expect(waiting.status).toBe(404)
      expect(waiting.data).toMatchObject({ message: "orders.unknown" })
      expect(refunding.status).toBe(409)
      expect(refunding.data).toMatchObject({ message: "payments.refunding" })
    })
  },
})

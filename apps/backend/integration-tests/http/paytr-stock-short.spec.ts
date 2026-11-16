import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, paytrNotification, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../src/lib/payments/checkout"
import { PAYMENT_RECOVERY_MODULE } from "../../src/modules/payment-recovery"
import type PaymentRecoveryModuleService from "../../src/modules/payment-recovery/service"
import { STOCK_LEDGER_MODULE } from "../../src/modules/stock-ledger"
import { WEBHOOK_EVENTS_MODULE } from "../../src/modules/webhook-events"
import type WebhookEventsModuleService from "../../src/modules/webhook-events/service"
import type StockLedgerModuleService from "../../src/modules/stock-ledger/service"
import { BACKORDER_MARK } from "../../src/lib/stock/backorder"
import { sweepBackorderRaises } from "../../src/workflows/payments/backorder-sweep"
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
      return data[0] as unknown as {
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
    const shelf = async () => {
      const [level] = await getContainer()
        .resolve(Modules.INVENTORY)
        .listInventoryLevels(
          { inventory_item_id: itemId, location_id: shop.locationId },
          { select: ["stocked_quantity", "reserved_quantity", "metadata"] }
        )
      return {
        stocked: Number(level?.stocked_quantity),
        reserved: Number(level?.reserved_quantity),
        marked: Boolean(level?.metadata?.[BACKORDER_MARK]),
      }
    }
    const ledger = (reference: string) =>
      getContainer()
        .resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
        .listStockMovements({ reference }, { order: { created_at: "ASC" } })
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
      // Beside the order's own "new order" alert, the one that asks for the missing units
      const alerts = (
        await eventually(
          () => shopAlerts(order.id),
          (rows) => rows.some((row) => row.data?.["kind"] === "stock_short")
        )
      ).filter((row) => row.data?.["kind"] === "stock_short")
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
      // The shelf raised for the completion only: back to its one unit, two held, no mark left
      expect(await shelf()).toEqual({ stocked: 1, reserved: 2, marked: false })
      expect((await variantRow())?.allow_backorder).toBe(false)
      // The ledger has the raise and the lowering under the cart, the order's hold between
      const moves = await ledger(`backorder:${cartId}`)
      expect(moves.map((move) => move.delta_stocked)).toEqual([1, -1])
      expect(alerts).toHaveLength(1)
      expect(alerts[0]?.data).toMatchObject({
        kind: "stock_short",
        order_id: order.id,
        number: String(order.display_id),
        lines: [{ title: lineTitle, short: 1 }],
        title: `Stok yetersiz sipariş #${String(order.display_id)}`,
      })
      expect(access.status).toBe(200)

      // A crash after the order opened, before its mark: the notice comes again and the
      // order is marked from the shelf, once
      await container
        .resolve(Modules.ORDER)
        .updateOrders(order.id, { metadata: { stock_short: "" } })
      const events = container.resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
      const [event] = await events.listWebhookEvents({ provider: "paytr" })
      await events.markFailed(event?.id ?? "", "processing_failed")
      const again = await notifyPaytr(http, success(merchantOid))
      const marked = await orderRow(order.id)

      expect(again.data).toBe("OK")
      expect(marked.metadata?.["stock_short"]).toMatchObject({
        lines: [{ variant_id: variantId, title: lineTitle, quantity: 1, short: 1 }],
      })
      expect(await orderOfCart(container, cartId)).toBe(order.id)
    })

    it("answers PayTR with no OK while the database is busy, and places it on the next notice", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const merchantOid = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(merchantOid)
      const inventory = container.resolve(Modules.INVENTORY)
      // The busy database for this cart's own reservation only, and proved to have met it.
      // A bare `mockRejectedValueOnce` gives its one failure to whichever caller of the
      // shared inventory service comes first; on a loaded CI runner (PR #117) the notice
      // answered 400 instead of 503, and the case could not tell which call the failure met
      const { data: carts } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "cart",
        fields: ["items.id"],
        filters: { id: cartId },
      })
      const lineIds = new Set(
        ((carts[0] as { items?: { id: string }[] } | undefined)?.items ?? []).map(({ id }) => id)
      )
      const original = inventory.createReservationItems.bind(inventory) as (
        ...args: unknown[]
      ) => Promise<unknown>
      let injected = 0
      const busy = jest.spyOn(inventory, "createReservationItems").mockImplementation(((
        ...args: unknown[]
      ) => {
        const items = [args[0]].flat() as { line_item_id?: string | null }[]
        if (injected === 0 && items.some((item) => lineIds.has(item.line_item_id ?? ""))) {
          injected += 1
          return Promise.reject(
            new Error("Knex: Timeout acquiring a connection. The pool is probably full.")
          )
        }
        return original(...args)
      }) as typeof inventory.createReservationItems)

      const first = await notifyPaytr(http, success(merchantOid))
      const between = await orderOfCart(container, cartId)
      busy.mockRestore()
      const second = await notifyPaytr(http, success(merchantOid))
      const order = await orderOfCart(container, cartId)

      // The failure met this cart's completion, once
      expect(lineIds.size).toBeGreaterThan(0)
      expect(injected).toBe(1)
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

    it("lowers a raise a crash left behind once it expires, and tells the shop", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const merchantOid = await startPaytrPayment(http, storefront.headers, cartId)
      await orderOne(container, shop, variantId)
      fake.pay(merchantOid)
      // The run stops after the raise: every later level write fails, as if the process died
      const inventory = container.resolve(Modules.INVENTORY)
      const write = inventory.updateInventoryLevels.bind(inventory)
      let writes = 0
      const crash = jest
        .spyOn(inventory, "updateInventoryLevels")
        .mockImplementation((...args: Parameters<typeof write>) => {
          writes += 1
          return writes === 1 ? write(...args) : Promise.reject(new Error("process gone"))
        })

      const answer = await notifyPaytr(http, success(merchantOid))
      crash.mockRestore()
      const left = await shelf()
      const early = await sweepBackorderRaises(container)
      const swept = await sweepBackorderRaises(container, Date.now() + 10 * 60 * 1000)
      const alerts = await eventually(
        () =>
          container
            .resolve(Modules.NOTIFICATION)
            .listNotifications({ channel: "feed", resource_id: cartId }, { select: ["data"] }),
        (rows) => rows.length > 0
      )

      expect(answer.data).toBe("OK")
      expect(await orderOfCart(container, cartId)).toMatch(/^order_/)
      // Exactly the shortfall left on the shelf, marked
      expect(left).toEqual({ stocked: 2, reserved: 2, marked: true })
      expect(early).toBe(0)
      expect(swept).toBe(1)
      expect(await shelf()).toEqual({ stocked: 1, reserved: 2, marked: false })
      expect(await sweepBackorderRaises(container, Date.now() + 10 * 60 * 1000)).toBe(0)
      expect(alerts[0]?.data).toMatchObject({ kind: "payment_issue", issue: "shelf_restored" })
    })

    it("opens no order for a payment PayTR shows refunded by hand, and tells the shop", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const merchantOid = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(merchantOid)
      fake.payments.get(merchantOid)?.refunds.push({ amount: 21000, referenceNo: null })

      const answer = await notifyPaytr(http, success(merchantOid))
      const recoveries = await container
        .resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
        .listPaymentRecoveries({ cart_id: cartId })
      const alerts = await container
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed", resource_id: cartId }, { select: ["data"] })

      expect(answer.data).toBe("OK")
      expect(await orderOfCart(container, cartId)).toBeNull()
      // Never given back a second time by the recovery job
      expect(recoveries).toEqual([])
      expect(alerts[0]?.data).toMatchObject({
        kind: "payment_issue",
        issue: "refunded_before_order",
        reference: merchantOid,
      })
    })

    it("tells the waiting page the payment it waits for is given back, not an older one's", async () => {
      const container = getContainer()
      const cartId = await readyCart(container, shop, variantId)
      const recoveries = container.resolve<PaymentRecoveryModuleService>(PAYMENT_RECOVERY_MODULE)
      const refundOf = (reference: string) =>
        recoveries.recordOrphan({
          provider: "paytr",
          reference,
          reason: "completion_failed",
          amount: 21000,
          currency_code: "try",
          test_mode: true,
          cart_id: cartId,
        })
      const ask = () =>
        settle(
          http.post(`/store/carts/${cartId}/order-access`, {}, { headers: storefront.headers })
        )

      const first = await startPaytrPayment(http, storefront.headers, cartId)
      const waiting = await ask()
      await refundOf(first)
      const refunding = await ask()
      // The shopper pays again: the first payment's refund says nothing of this one
      await startPaytrPayment(http, storefront.headers, cartId)
      const again = await ask()

      expect(waiting.status).toBe(404)
      expect(waiting.data).toMatchObject({ message: "orders.unknown" })
      expect(refunding.status).toBe(409)
      expect(refunding.data).toMatchObject({ message: "payments.refunding" })
      expect(again.status).toBe(404)
    })
  },
})

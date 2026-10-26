import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { toMedusaAmount } from "../../src/lib/money"
import type { Kurus } from "../../src/lib/money"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { readOrderMoney, returnRefundOf } from "../../src/workflows/orders/order-money"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(240 * 1000)

interface MoneyLine {
  id: string
  kind: "item" | "shipping"
  quantity: number
  returned: number
  gross: string
  discount: string
  net: string
  returned_net: string
}

interface Money {
  lines: MoneyLine[]
  items: { gross: string; discount: string; net: string }
  discount: string
  net: string
  paid: string
  refunded: string
  refundable: string
}

async function orderFacts(container: MedusaContainer, orderId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["items.id", "items.unit_price", "payment_collections.payments.id"],
    filters: { id: orderId },
  })
  const order = data[0] as {
    items: { id: string; unit_price: number }[]
    payment_collections: { payments: { id: string }[] }[]
  }
  const lineAt = (price: number) => order.items.find((item) => item.unit_price === price)?.id ?? ""
  const paymentId = order.payment_collections[0]?.payments[0]?.id ?? ""
  return { lineAt, paymentId }
}

/** F4.7 (KK): a discounted order's lines in kuruş, and partial refunds that never drift. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    const post = async (url: string, body: unknown = {}) => {
      const response = await settle(http.post(url, body, { headers: admin.headers }))
      expect({ url, status: response.status, body: response.data }).toMatchObject({ status: 200 })
      return response.data
    }

    // Through Medusa's own return screens: ask, confirm, receive
    async function giveBack(
      orderId: string,
      shop: StockShop,
      itemId: string,
      quantity = 1,
      shippingCost?: number
    ) {
      const begun = (await post("/admin/returns", {
        order_id: orderId,
        location_id: shop.locationId,
      })) as { return: { id: string } }
      const id = begun.return.id
      const items = [{ id: itemId, quantity }]
      await post(`/admin/returns/${id}/request-items`, { items })
      if (shippingCost !== undefined) {
        await post(`/admin/returns/${id}/shipping-method`, {
          shipping_option_id: shop.shippingOptionId,
          custom_amount: shippingCost,
        })
      }
      await post(`/admin/returns/${id}/request`)
      await post(`/admin/returns/${id}/receive`)
      await post(`/admin/returns/${id}/receive-items`, { items })
      await post(`/admin/returns/${id}/receive/confirm`)
    }

    const refundPayment = (paymentId: string, amount: Kurus) =>
      post(`/admin/payments/${paymentId}/refund`, { amount: Number(toMedusaAmount(amount)) })

    // A delivered order with 10% off under `code`: by delivery Medusa has copied
    // the adjustments into each new order version
    async function discountedOrder(code: string, lines: { price: number; quantity: number }[]) {
      const container = getContainer()
      const shop = await stockShop(container)
      const variants = []
      for (const [index, line] of lines.entries()) {
        const made = await stockedProduct(
          container,
          shop,
          `${code.toLowerCase()}-${String(index)}`,
          10,
          line.price
        )
        variants.push({ variant_id: made.variantId, quantity: line.quantity })
      }
      await post("/admin/promotions", {
        code,
        type: "standard",
        is_automatic: false,
        is_tax_inclusive: true,
        status: "active",
        application_method: {
          type: "percentage",
          target_type: "order",
          allocation: "across",
          value: 10,
        },
      })
      const orderId = await placeOrder(container, {
        ...shop,
        items: variants,
        promo_codes: [code],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
      await advanceOrder(container, orderId, "delivered")
      return { container, shop, orderId, ...(await orderFacts(container, orderId)) }
    }

    it("refunds a discounted line unit by unit to exactly what it was paid (KK)", async () => {
      const { container, shop, orderId, lineAt, paymentId } = await discountedOrder("ONDA", [
        { price: 33.33, quantity: 3 },
        { price: 20, quantity: 1 },
      ])

      // 10% of 3 × 33.33 is 9.999 in Medusa: in kuruş the line carries 10.00 of the 12.00
      const read = await settle(
        http.get<{ money: Money }>(`/admin/orders/${orderId}/money`, { headers: admin.headers })
      )
      expect(read.status).toBe(200)
      const money = read.data.money
      expect(money.lines.find((line) => line.id === lineAt(33.33))).toMatchObject({
        quantity: 3,
        gross: "99.99",
        discount: "10.00",
        net: "89.99",
      })
      expect(money.lines.find((line) => line.id === lineAt(20))).toMatchObject({
        gross: "20.00",
        discount: "2.00",
        net: "18.00",
      })
      expect(money.discount).toBe("12.00")
      expect(money.items).toEqual({ gross: "119.99", discount: "12.00", net: "107.99" })
      // What the lines were paid is what was taken from the customer
      expect(money.net).toBe(money.paid)

      // One unit at a time, each refunded as Medusa's refund screen would: never 30.00 three times
      const refunds: string[] = []
      for (let unit = 0; unit < 3; unit++) {
        const refund = await returnRefundOf(container, orderId, [
          { id: lineAt(33.33), quantity: 1 },
        ])
        refunds.push(toMedusaAmount(refund.total))
        await giveBack(orderId, shop, lineAt(33.33))
        await refundPayment(paymentId, refund.total)
      }
      expect(refunds).toEqual(["30.00", "29.99", "30.00"])

      const boardRefund = await returnRefundOf(container, orderId, [
        { id: lineAt(20), quantity: 1 },
      ])
      expect(toMedusaAmount(boardRefund.total)).toBe("18.00")
      await giveBack(orderId, shop, lineAt(20))
      await refundPayment(paymentId, boardRefund.total)

      const after = await readOrderMoney(container, orderId)
      after.lines
        .filter((line) => line.kind === "item")
        .forEach((line) => {
          expect(line.returned).toBe(line.quantity)
          expect(line.returned_net).toBe(line.net)
        })
      expect(toMedusaAmount(after.refunded)).toBe("107.99")
      // Only the shipping is left to refund
      const shipping = after.lines.filter((line) => line.kind === "shipping")
      expect(after.refundable).toBe(shipping.reduce((sum, line) => sum + line.net, 0))
    })

    it("refunds a whole order ending in half a kuruş, its return's shipping left out", async () => {
      const { container, shop, orderId, lineAt, paymentId } = await discountedOrder("ONBES", [
        { price: 33.35, quantity: 3 },
      ])
      // 10% of 3 × 33.35 is 10.005: Medusa took a total ending in half a kuruş
      const placed = await readOrderMoney(container, orderId)
      expect(placed.lines.find((line) => line.id === lineAt(33.35))).toMatchObject({
        discount: 1000,
        net: 9005,
      })
      expect(placed.net).toBe(placed.paid)

      const refund = await returnRefundOf(container, orderId, [{ id: lineAt(33.35), quantity: 3 }])
      expect(refund.total).toBe(9005)
      await giveBack(orderId, shop, lineAt(33.35), 3, 15)
      // The return's shipping is the shop's cost, not a line the customer paid
      const returned = await readOrderMoney(container, orderId)
      expect(returned.shipping).toEqual(placed.shipping)
      expect(returned.net).toBe(placed.net)

      // Everything shown as refundable, to the last half kuruş: Medusa takes it all
      await refundPayment(paymentId, refund.total)
      const left = (await readOrderMoney(container, orderId)).refundable
      expect(left).toBe(placed.shipping.net)
      await refundPayment(paymentId, left)
      const done = await readOrderMoney(container, orderId)
      expect(done.refunded).toBe(placed.net)
      expect(done.refundable).toBe(0)
    })

    it("answers 404 for an order that does not exist", async () => {
      const read = await settle(
        http.get("/admin/orders/order_missing/money", { headers: admin.headers })
      )
      expect(read.status).toBe(404)
    })
  },
})

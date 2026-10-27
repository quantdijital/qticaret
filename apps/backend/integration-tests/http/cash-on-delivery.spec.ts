import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const COD = "pp_cod_cod"

interface CartItem {
  id: string
  metadata?: Record<string, unknown> | null
  unit_price: number
}

/** F6 W3 (adr/0029): paying at the door, its fee a line of its own worked out on the server. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    const settings = (values: Record<string, unknown>) =>
      settle(
        http.post("/admin/platform-settings/cash_on_delivery", values, { headers: admin.headers })
      )
    const flag = async (enabled: boolean) => {
      const answer = await settle(
        http.post(
          "/admin/features/payments.cash_on_delivery",
          { enabled },
          { headers: admin.headers }
        )
      )
      if (answer.status !== 200) {
        throw new Error(
          `turning cash on delivery ${enabled ? "on" : "off"} answered ${String(answer.status)}: ${JSON.stringify(answer.data)}`
        )
      }
    }
    const start = (cartId: string, providerId = COD) =>
      settle(
        http.post<{ payment_session: { data: Record<string, unknown> }; message?: string }>(
          `/store/carts/${cartId}/payment-session`,
          { provider_id: providerId },
          { headers: storefront.headers }
        )
      )
    const itemsOf = async (cartId: string) =>
      (
        await http.get<{ cart: { items: CartItem[] } }>(`/store/carts/${cartId}`, {
          headers: storefront.headers,
        })
      ).data.cart.items
    const feeLine = async (cartId: string) =>
      (await itemsOf(cartId)).find((item) => item.metadata?.["qt_fee"] === "cash_on_delivery")
    const complete = (cartId: string) =>
      settle(
        http.post<{ type: string; order?: { id: string }; error?: { message: string } }>(
          `/store/carts/${cartId}/complete`,
          {},
          { headers: storefront.headers }
        )
      )

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await createAdminUser(http, container)
      const saved = await settings({
        fee_type: "fixed",
        fee_value: 2_500,
        max_amount: 100_000,
        shipping_option_ids: [shop.shippingOptionId],
      })
      if (saved.status !== 200) {
        throw new Error(`settings answered ${String(saved.status)}: ${JSON.stringify(saved.data)}`)
      }
      await flag(true)
    })

    it("is not offered with the flag off, over the limit, or with a courier that does not collect", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)

      await flag(false)
      const off = await start(cartId)
      await flag(true)
      await settings({ max_amount: 10_000 })
      const over = await start(cartId)
      await settings({ max_amount: 0, shipping_option_ids: [] })
      const courier = await start(cartId)
      const { data: methods } = await http.get<{ cash_on_delivery: unknown }>(
        `/store/payment/methods?cart_id=${cartId}`,
        { headers: storefront.headers }
      )

      expect(off.data).toMatchObject({ message: "cash_on_delivery.disabled" })
      expect(over.data).toMatchObject({ message: "cash_on_delivery.over_limit" })
      expect(courier.data).toMatchObject({ message: "cash_on_delivery.shipping_unsupported" })
      expect(methods.cash_on_delivery).toBeNull()
      expect(await feeLine(cartId)).toBeUndefined()
    })

    it("adds its fee as a line of its own and places the order to be paid at the door", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)

      const { data: methods } = await http.get<{ cash_on_delivery: unknown }>(
        `/store/payment/methods?cart_id=${cartId}`,
        { headers: storefront.headers }
      )
      const started = await start(cartId)
      const fee = await feeLine(cartId)
      const completed = await complete(cartId)
      const { data: order } = await http.get<{ order: { payment_status: string; total: number } }>(
        `/admin/orders/${completed.data.order?.id ?? ""}?fields=payment_status,total`,
        { headers: admin.headers }
      )

      expect(methods.cash_on_delivery).toEqual({ provider_id: COD, fee: "25.00" })
      expect(started.data.payment_session.data).toMatchObject({
        method: "cash_on_delivery",
        fee: 2_500,
        amount: 23_500,
      })
      expect(fee?.unit_price).toBe(25)
      expect(order.order).toMatchObject({ payment_status: "authorized", total: 235 })
    })

    it("takes the fee off again when another way to pay is chosen", async () => {
      await http.post(
        "/admin/platform-settings/bank_transfer",
        {
          enabled: true,
          account_holder: "Örnek Ticaret A.Ş.",
          bank_name: "Örnek Bankası",
          iban: "TR330006100519786457841326",
        },
        { headers: admin.headers }
      )
      const cartId = await readyCart(getContainer(), shop, variantId)

      await start(cartId)
      const bank = await start(cartId, "pp_bank-transfer_bank-transfer")

      expect(await feeLine(cartId)).toBeUndefined()
      expect(bank.data.payment_session.data).toMatchObject({ amount: 21_000 })
    })

    it("lets no shopper change or remove the fee, and no cart complete with one that no longer fits", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      await start(cartId)
      const fee = (await feeLine(cartId))?.id ?? ""

      const changed = await settle(
        http.post(
          `/store/carts/${cartId}/line-items/${fee}`,
          { quantity: 0 },
          { headers: storefront.headers }
        )
      )
      const removed = await settle(
        http.delete(`/store/carts/${cartId}/line-items/${fee}`, { headers: storefront.headers })
      )
      await settings({ fee_value: 3_000 })
      const stale = await complete(cartId)

      expect(changed.data).toMatchObject({ message: "cash_on_delivery.fee_line_locked" })
      expect(removed.data).toMatchObject({ message: "cash_on_delivery.fee_line_locked" })
      expect(stale.data.type).not.toBe("order")
      expect(JSON.stringify(stale.data)).toMatch(/cash_on_delivery\.fee_mismatch/)
    })

    it("ships it unpaid, and the shop takes the money in once the courier reports it", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      await start(cartId)
      const orderId = (await complete(cartId)).data.order?.id ?? ""

      const shipped = await settle(
        http.post(`/admin/orders/${orderId}/ship`, {}, { headers: admin.headers })
      )
      const { data } = await http.get<{
        order: { payment_collections: { payments: { id: string }[] }[] }
      }>(`/admin/orders/${orderId}?fields=payment_collections.payments.id`, {
        headers: admin.headers,
      })
      const paymentId = data.order.payment_collections[0]?.payments[0]?.id ?? ""
      await http.post(`/admin/payments/${paymentId}/capture`, {}, { headers: admin.headers })
      const { data: after } = await http.get<{ order: { payment_status: string } }>(
        `/admin/orders/${orderId}?fields=payment_status`,
        { headers: admin.headers }
      )

      expect(shipped.status).toBe(200)
      expect(after.order.payment_status).toBe("captured")
    })
  },
})

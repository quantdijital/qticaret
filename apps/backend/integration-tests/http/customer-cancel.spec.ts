import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { cancelRefundReference } from "../../src/lib/orders/locks"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS, readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

/** F7.13: a shopper cancels their own order before it is packed, and gets the money back. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let customer: TestCustomer
    let admin: { headers: Record<string, string> }
    let variantId: string

    /** An order of one unit placed with the system provider, made the customer's. */
    const ownOrder = async (owner = customer) => {
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
      })
      await getContainer().resolve(Modules.ORDER).updateOrders(orderId, { customer_id: owner.id })
      return orderId
    }
    const cancel = (orderId: string, who = customer) =>
      settle(
        http.post<{ canceled?: boolean; message?: string }>(
          `/store/orders/${orderId}/cancel`,
          {},
          { headers: who.headers }
        )
      )
    const statusOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["status"], filters: { id: orderId } })
      return (data[0] as { status: string }).status
    }
    const reserved = async () => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product_variant",
          fields: ["inventory_items.inventory.reserved_quantity"],
          filters: { id: variantId },
        })
      return (data[0] as { inventory_items: { inventory: { reserved_quantity: number } }[] })
        .inventory_items[0]?.inventory.reserved_quantity
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      customer = await registerCustomer(http, storefront)
      admin = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120))
        .variantId
    })

    it("cancels the shopper's own order before it is packed and gives its stock back", async () => {
      const orderId = await ownOrder()
      const before = await reserved()

      const canceled = await cancel(orderId)
      const again = await cancel(orderId)

      expect(canceled.data).toMatchObject({ canceled: true })
      expect(again.status).toBe(200)
      expect(await statusOf(orderId)).toBe("canceled")
      expect(await reserved()).toBe((before ?? 1) - 1)
    })

    it("sends a shopper whose bank transfer the shop confirmed to the shop: that money goes back by hand", async () => {
      await http.post(
        "/admin/platform-settings/bank_transfer",
        {
          enabled: true,
          account_holder: "Örnek Ticaret A.Ş.",
          bank_name: "Örnek Bankası",
          iban: "TR330006100519786457841326",
          deadline_hours: 24,
        },
        { headers: admin.headers }
      )
      const cartId = await readyCart(getContainer(), shop, variantId)
      await http.post(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: "pp_bank-transfer_bank-transfer" },
        { headers: storefront.headers }
      )
      const { data } = await http.post<{ order: { id: string } }>(
        `/store/carts/${cartId}/complete`,
        {},
        { headers: storefront.headers }
      )
      const orderId = data.order.id
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id })
      await http.post(
        `/admin/orders/${orderId}/bank-transfer/confirm`,
        {},
        { headers: admin.headers }
      )

      const canceled = await cancel(orderId)
      const { data: refunds } = await http.get<{ refunds: unknown[] }>(
        `/admin/orders/${orderId}/payment-details`,
        { headers: admin.headers }
      )

      // A refund written down only would leave the shopper without the money
      expect(canceled.data.message).toBe("orders.cancel_contact_shop")
      expect(await statusOf(orderId)).not.toBe("canceled")
      expect(refunds.refunds).toEqual([])
    })

    it("never ships an order whose cancel already gave the money back", async () => {
      const orderId = await ownOrder()
      // Medusa's cancel failed after our refund went through
      await getContainer()
        .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
        .createOrderRefunds({
          order_id: orderId,
          reference: cancelRefundReference(orderId),
          payment_id: "pay_cancelled",
          amount: 21_000,
          status: "done",
          lines: [] as unknown as Record<string, unknown>,
        })

      const shipped = await settle(
        http.post<{ message?: string }>(
          `/admin/orders/${orderId}/ship`,
          { notify: false },
          { headers: admin.headers }
        )
      )

      expect(shipped.data.message).toBe("orders.ship_canceled_refund")
    })

    it("refuses a packed order (a return instead) and another shopper's order", async () => {
      const shipped = await ownOrder()
      await http.post(
        `/admin/orders/${shipped}/ship`,
        { notify: false },
        { headers: admin.headers }
      )
      const someoneElse = await registerCustomer(http, storefront)
      const theirs = await ownOrder(someoneElse)

      const packed = await cancel(shipped)
      const foreign = await cancel(theirs)
      const anonymous = await settle(
        http.post(`/store/orders/${theirs}/cancel`, {}, { headers: storefront.headers })
      )

      expect(packed.data.message).toBe("orders.cancel_after_packing")
      expect(await statusOf(shipped)).not.toBe("canceled")
      expect(foreign.status).toBe(404)
      // Without a session or the order's key there is no such order (adr/0037 §2)
      expect(anonymous.status).toBe(404)
      expect(await statusOf(theirs)).not.toBe("canceled")
    })
  },
})

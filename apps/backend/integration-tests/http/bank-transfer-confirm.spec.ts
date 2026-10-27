import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { expireBankTransfers } from "../../src/jobs/bank-transfer-expiry"
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

const HOUR = 60 * 60 * 1000

/** F6 W2 (adr/0029): a bank transfer confirmed by hand, or cancelled when its time runs out. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    /** An order placed by bank transfer, awaiting the money (24 hours to pay). */
    const awaitingOrder = async () => {
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
      return data.order.id
    }
    const confirm = (orderId: string) =>
      settle(
        http.post<{ bank_transfer: { made_before: boolean }; message?: string }>(
          `/admin/orders/${orderId}/bank-transfer/confirm`,
          {},
          { headers: admin.headers }
        )
      )
    const orderOf = async (orderId: string) =>
      (
        await http.get<{ order: { status: string; payment_status: string } }>(
          `/admin/orders/${orderId}?fields=status,payment_status`,
          { headers: admin.headers }
        )
      ).data.order
    const reservationsOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
      const lineIds = (data[0] as { items: { id: string }[] }).items.map(({ id }) => id)
      return getContainer()
        .resolve(Modules.INVENTORY)
        .listReservationItems({ line_item_id: lineIds })
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await createAdminUser(http, container)
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
    })

    it("takes the confirmed money as the order's payment, once", async () => {
      const orderId = await awaitingOrder()

      const first = await confirm(orderId)
      const again = await confirm(orderId)

      expect(first.data.bank_transfer).toMatchObject({ made_before: false })
      expect(again.data.bank_transfer).toMatchObject({ made_before: true })
      expect(await orderOf(orderId)).toMatchObject({ payment_status: "captured" })
    })

    it("ships no order whose money is awaited, on our route or Medusa's; once confirmed, it can", async () => {
      const orderId = await awaitingOrder()

      const ours = await settle(
        http.post(`/admin/orders/${orderId}/ship`, {}, { headers: admin.headers })
      )
      const medusas = await settle(
        http.post(
          `/admin/orders/${orderId}/fulfillments`,
          { items: [] },
          { headers: admin.headers }
        )
      )
      await confirm(orderId)
      const paid = await settle(
        http.post(`/admin/orders/${orderId}/ship`, {}, { headers: admin.headers })
      )

      expect(ours.data).toMatchObject({ message: "orders.payment_awaited" })
      expect(medusas.data).toMatchObject({ message: "orders.payment_awaited" })
      expect(paid.status).toBe(200)
    })

    it("cancels orders whose time to pay ran out and gives their stock back; one within it waits", async () => {
      const first = await awaitingOrder()
      const second = await awaitingOrder()

      const early = await expireBankTransfers(getContainer(), new Date(Date.now() + 2 * HOUR))
      const late = await expireBankTransfers(getContainer(), new Date(Date.now() + 25 * HOUR))

      expect(early).toBe(0)
      expect(late).toBe(2)
      expect(await orderOf(first)).toMatchObject({ status: "canceled" })
      expect(await orderOf(second)).toMatchObject({ status: "canceled" })
      expect(await reservationsOf(first)).toHaveLength(0)
    })

    it("confirms no cancelled order", async () => {
      const orderId = await awaitingOrder()
      await expireBankTransfers(getContainer(), new Date(Date.now() + 25 * HOUR))

      const cancelled = await confirm(orderId)

      expect(cancelled.data).toMatchObject({ message: "bank_transfer.order_canceled" })
    })

    it("leaves a confirmed transfer to its time, and Medusa's cancel still cancels one awaited", async () => {
      const confirmed = await awaitingOrder()
      const awaited = await awaitingOrder()
      await confirm(confirmed)

      const cancel = await settle(
        http.post(`/admin/orders/${awaited}/cancel`, {}, { headers: admin.headers })
      )
      const expired = await expireBankTransfers(getContainer(), new Date(Date.now() + 25 * HOUR))

      expect(expired).toBe(0)
      expect(await orderOf(confirmed)).toMatchObject({ payment_status: "captured" })
      expect(cancel.status).toBe(200)
      expect(await orderOf(awaited)).toMatchObject({ status: "canceled" })
    })

    it("takes no dispute against money the shop confirmed itself", async () => {
      const orderId = await awaitingOrder()
      await confirm(orderId)

      const disputed = await settle(
        http.post(
          "/admin/chargebacks",
          { order_id: orderId, amount: 10, reason: "other" },
          { headers: admin.headers }
        )
      )

      expect(disputed.data).toMatchObject({ message: "chargebacks.order_unpaid" })
    })
  },
})

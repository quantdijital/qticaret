import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
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

// A made-up account whose check digits hold (mod-97); the shop's own, shown to shoppers
const IBAN = "TR330006100519786457841326"
const BANK = "pp_bank-transfer_bank-transfer"

/** F6 W1 (adr/0029): paying by bank transfer, the order placed awaiting the money. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    const configure = (settings: Record<string, unknown>) =>
      settle(
        http.post("/admin/platform-settings/bank_transfer", settings, { headers: admin.headers })
      )
    const turnOn = () =>
      configure({
        enabled: true,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "tr33 0006 1005 1978 6457 8413 26",
        deadline_hours: 24,
      })
    const start = (cartId: string, body: Record<string, unknown> = { provider_id: BANK }) =>
      settle(
        http.post<{ payment_session: { status: string; data: Record<string, unknown> } }>(
          `/store/carts/${cartId}/payment-session`,
          body,
          { headers: storefront.headers }
        )
      )
    const complete = (cartId: string) =>
      settle(
        http.post<{ type: string; order?: { id: string } }>(
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
    })

    it("is not offered before the shop turns it on with an account that is one", async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)

      const off = await start(cartId)
      const noAccount = await configure({ enabled: true })
      const notAnIban = await configure({ iban: "TR340006100519786457841326" })

      expect(off.data).toMatchObject({ message: "bank_transfer.not_configured" })
      // Medusa's body validator puts its own words before the key
      expect(noAccount.data).toMatchObject({
        message: expect.stringContaining("bank_transfer.incomplete") as unknown,
      })
      expect(notAnIban.data).toMatchObject({
        message: expect.stringContaining("bank_transfer.iban_invalid") as unknown,
      })
    })

    it("shows the shop's account and starts with no return address; a card form still needs one", async () => {
      await turnOn()
      const cartId = await readyCart(getContainer(), shop, variantId)

      const { data: methods } = await http.get<{ bank_transfer: Record<string, unknown> }>(
        "/store/payment/methods",
        { headers: storefront.headers }
      )
      const started = await start(cartId)
      const card = await start(cartId, { provider_id: "pp_paytr_paytr" })

      expect(methods.bank_transfer).toEqual({
        provider_id: BANK,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "TR33 0006 1005 1978 6457 8413 26",
        deadline_hours: 24,
      })
      expect(started.data.payment_session).toMatchObject({
        status: "pending",
        data: { method: "bank_transfer", amount: 21000, iban: IBAN, deadline_hours: 24 },
      })
      expect(card.data).toMatchObject({
        message: expect.stringContaining("payments.return_urls_required") as unknown,
      })
    })

    it("places the order awaiting the money, its stock held, not counted as paid", async () => {
      await turnOn()
      const cartId = await readyCart(getContainer(), shop, variantId)
      await start(cartId)

      const completed = await complete(cartId)
      const orderId = completed.data.order?.id ?? ""
      const { data: order } = await http.get<{ order: { payment_status: string } }>(
        `/admin/orders/${orderId}?fields=payment_status`,
        { headers: admin.headers }
      )
      const { data: items } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
      const lineIds = (items[0] as { items: { id: string }[] }).items.map(({ id }) => id)
      const reservations = await getContainer()
        .resolve(Modules.INVENTORY)
        .listReservationItems({ line_item_id: lineIds })
      const { data: summary } = await http.get<{ open_orders: number; awaiting_shipment: number }>(
        "/admin/home/summary",
        { headers: admin.headers }
      )

      expect(completed.data.type).toBe("order")
      expect(order.order.payment_status).toBe("awaiting")
      expect(reservations).toHaveLength(1)
      expect(summary).toMatchObject({ open_orders: 1, awaiting_shipment: 0 })
    })
  },
})

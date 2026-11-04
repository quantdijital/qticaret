import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { debitAccountsWorkflow } from "@medusajs/loyalty-plugin/workflows"
import { RETURN_REQUESTS_MODULE } from "../../src/modules/return-requests"
import type ReturnRequestsModuleService from "../../src/modules/return-requests/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { issueOrderGiftCards } from "../../src/workflows/gift-cards/issue-and-send"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { giftCardProduct, orderLines } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface Card {
  id: string
  store_credit_account: {
    id: string
    balance: number | string
    transactions: { type: string; reference: string; reference_id: string }[]
  }
}

interface Answer {
  canceled?: boolean
  message?: string
}

interface Returnable {
  cancellable: boolean
  cancel_refusal: string | null
  lines: { window_open: boolean; window_closed_reason: string | null }[]
}

/**
 * adr/0025, 2026-11-03: an order of gift cards is cancelled only while
 * every card it sent is untouched; those cards are voided before the money
 * goes back. Once one was spent the cancel is refused, for the shopper and
 * for staff alike. A withdrawal still waiting closes with the cancel, and
 * no card gives more than its balance.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let customer: TestCustomer

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )
    const cancel = (orderId: string) =>
      settle(
        http.post<Answer>(`/store/orders/${orderId}/cancel`, {}, { headers: customer.headers })
      )
    const staffCancel = (orderId: string) =>
      settle(http.post<Answer>(`/admin/orders/${orderId}/cancel`, {}, { headers: admin.headers }))
    const cardsOf = async (lineId: string) => {
      const { data } = await query().graph({
        entity: "gift_card",
        fields: [
          "id",
          "store_credit_account.id",
          "store_credit_account.balance",
          "store_credit_account.transactions.type",
          "store_credit_account.transactions.reference",
          "store_credit_account.transactions.reference_id",
        ],
        filters: { line_item_id: lineId },
      })
      return data as unknown as Card[]
    }
    const balancesOf = async (lineId: string) =>
      (await cardsOf(lineId)).map((card) => Number(card.store_credit_account.balance)).sort()
    /** The order's status and the money given back on it, in lira. */
    const stateOf = async (orderId: string) => {
      const { data } = await query().graph({
        entity: "order",
        fields: ["status", "payment_collections.payments.refunds.amount"],
        filters: { id: orderId },
      })
      const row = data[0] as {
        status: string
        payment_collections: { payments: { refunds: { amount: number | string }[] }[] }[]
      }
      const refunded = row.payment_collections
        .flatMap((collection) => collection.payments)
        .flatMap((payment) => payment.refunds)
        .reduce((sum, refund) => sum + Number(refund.amount), 0)
      return { status: row.status, refunded }
    }
    /** Spends `amount` lira off the line's first card, as a checkout does. */
    const spend = async (lineId: string, amount = 100) => {
      const [card] = await cardsOf(lineId)
      await debitAccountsWorkflow(getContainer()).run({
        input: [
          {
            account_id: card?.store_credit_account.id ?? "",
            amount,
            reference: "cart",
            reference_id: "cart_test",
          },
        ],
      })
    }

    /**
     * The customer's order of `quantity` 500 TL cards on one line, paid by
     * card (the system provider, captured with no event of its own, so no
     * card goes out by itself) and, unless told, its cards issued.
     */
    const giftOrder = async (quantity: number, issue = true) => {
      const container = getContainer()
      const { variants } = await giftCardProduct(http, admin.headers, shop)
      const orderId = await placeOrder(container, {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        items: [{ variant_id: variants["500"], quantity }],
        email: "ayse.yilmaz@example.com",
        address: PAYTR_ADDRESS,
        beforeComplete: async (cartId) => {
          const { data } = await query().graph({
            entity: "cart",
            fields: ["items.id"],
            filters: { id: cartId },
          })
          for (const line of (data[0] as { items: { id: string }[] }).items) {
            await http.post(
              `/store/carts/${cartId}/line-items/${line.id}/gift`,
              { recipient_email: "zeynep.kaya@example.com" },
              { headers: store.headers }
            )
          }
        },
      })
      await container.resolve(Modules.ORDER).updateOrders(orderId, { customer_id: customer.id })
      const { data } = await query().graph({
        entity: "order",
        fields: ["payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const paymentId =
        (data[0] as { payment_collections: { payments: { id: string }[] }[] })
          .payment_collections[0]?.payments[0]?.id ?? ""
      await container.resolve(Modules.PAYMENT).capturePayment({ payment_id: paymentId })
      if (issue) {
        await issueOrderGiftCards(container, orderId)
      }
      const [line] = await orderLines(container, orderId)
      return { orderId, lineId: line?.id ?? "" }
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      customer = await registerCustomer(http, store)
      await flag(true)
    })
    // The flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag(false)
    })

    it("cancels as before while no card went out, and none goes out after", async () => {
      const { orderId, lineId } = await giftOrder(1, false)

      const canceled = await cancel(orderId)
      const issued = await issueOrderGiftCards(getContainer(), orderId)

      expect(canceled.status).toBe(200)
      expect(canceled.data).toMatchObject({ canceled: true })
      expect(await stateOf(orderId)).toEqual({ status: "canceled", refunded: 500 })
      expect(issued.issued).toBe(0)
      expect(await cardsOf(lineId)).toEqual([])
    })

    it("voids untouched cards, then gives the money back and cancels", async () => {
      const { orderId, lineId } = await giftOrder(2)
      const before = await balancesOf(lineId)

      const canceled = await cancel(orderId)
      const again = await cancel(orderId)
      const cards = await cardsOf(lineId)

      expect(before).toEqual([500, 500])
      expect(canceled.status).toBe(200)
      expect(again.status).toBe(200)
      expect(await stateOf(orderId)).toEqual({ status: "canceled", refunded: 1000 })
      expect(await balancesOf(lineId)).toEqual([0, 0])
      for (const card of cards) {
        expect(card.store_credit_account.transactions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "debit",
              reference: "order_cancel",
              reference_id: orderId,
            }),
          ])
        )
      }
    })

    it("refuses once a card was spent, and changes nothing", async () => {
      const { orderId, lineId } = await giftOrder(2)
      await spend(lineId)

      const refused = await cancel(orderId)
      const cards = await cardsOf(lineId)

      expect([refused.status, refused.data.message]).toEqual([409, "orders.gift_card_used"])
      expect(await stateOf(orderId)).toEqual({ status: "pending", refunded: 0 })
      expect(await balancesOf(lineId)).toEqual([400, 500])
      expect(
        cards
          .flatMap((card) => card.store_credit_account.transactions)
          .map((move) => move.reference)
      ).not.toContain("order_cancel")
    })

    it("closes a withdrawal still waiting, and the page then offers neither cancel nor return", async () => {
      const { orderId, lineId } = await giftOrder(1)
      const returnable = () =>
        http.get<Returnable>(`/store/orders/${orderId}/returnable`, { headers: customer.headers })
      const asked = await settle(
        http.post<{ return_request: { id: string } }>(
          `/store/orders/${orderId}/returns`,
          { items: [{ line_item_id: lineId, quantity: 1 }], reason: "changed_mind" },
          { headers: customer.headers }
        )
      )
      const before = (await returnable()).data

      const canceled = await cancel(orderId)
      const [request] = await getContainer()
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .listReturnRequests({ id: asked.data.return_request.id })
      const after = (await returnable()).data

      expect(asked.status).toBe(200)
      expect(before).toMatchObject({ cancellable: true, cancel_refusal: null })
      expect(before.lines[0]).toMatchObject({ window_open: true, window_closed_reason: null })
      expect(canceled.status).toBe(200)
      expect(request).toMatchObject({
        status: "canceled",
        cancel_cause: "order_canceled",
        canceled_by: null,
      })
      expect(after).toMatchObject({ cancellable: false, cancel_refusal: "orders.canceled" })
      expect(after.lines[0]).toMatchObject({
        window_open: false,
        window_closed_reason: "order_canceled",
      })
    })

    // The loyalty plugin (2.21.2) refuses it ("Insufficient balance"), whatever debits it
    it("cannot take more off a card than its balance", async () => {
      const { lineId } = await giftOrder(1)
      // A workflow rejects with its error's fields, not an Error: read its message
      const outcome = await spend(lineId, 600).then(
        () => "debited",
        (error: unknown) => (error as { message?: string }).message
      )

      expect(outcome).toBe("Insufficient balance")
      expect(await balancesOf(lineId)).toEqual([500])
    })

    it("holds staff's cancel to the same rule", async () => {
      const spent = await giftOrder(1)
      const unused = await giftOrder(1)
      await spend(spent.lineId)

      const refused = await staffCancel(spent.orderId)
      const canceled = await staffCancel(unused.orderId)

      expect([refused.status, refused.data.message]).toEqual([409, "orders.gift_card_used"])
      expect(await stateOf(spent.orderId)).toEqual({ status: "pending", refunded: 0 })
      expect(await balancesOf(spent.lineId)).toEqual([400])
      expect(canceled.status).toBe(200)
      expect(await stateOf(unused.orderId)).toEqual({ status: "canceled", refunded: 500 })
      expect(await balancesOf(unused.lineId)).toEqual([0])
    })
  },
})

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { debitAccountsWorkflow } from "@medusajs/loyalty-plugin/workflows"
import { issueOrderGiftCards } from "../../src/workflows/gift-cards/issue-and-send"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import { BANK_TRANSFER, giftCardProduct, giftCart, orderLines } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface Request {
  id: string
  status: string
  refund_amount: string | null
}

interface Line {
  line_item_id: string
  returnable: number
  gift_card: boolean
  withdrawal_excluded: boolean
  withdrawal_excluded_reason: string | null
}

interface Card {
  id: string
  value: number
  store_credit_account: {
    id: string
    balance: number
    transactions: { type: string; reference: string; reference_id: string }[]
  }
}

/**
 * adr/0025, the owner's decision of 2026-11-03 (TASLAK, avukat onayı
 * bekler): a gift card line is withdrawn from while its cards are unused,
 * its cards voided on the shop's acceptance and the money given back;
 * once a card was spent, never.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let customer: TestCustomer

    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )
    const post = (url: string, body: unknown) =>
      settle(
        http.post<{ message?: string } & Record<string, unknown>>(url, body, {
          headers: store.headers,
        })
      )
    const ask = (orderId: string, body: unknown) =>
      settle(
        http.post<{ return_request: Request; message?: string }>(
          `/store/orders/${orderId}/returns`,
          body,
          { headers: customer.headers }
        )
      )
    const approve = (requestId: string) =>
      settle(
        http.post<{ return_request: Request; refund_error: string | null; message?: string }>(
          `/admin/return-requests/${requestId}/approve`,
          {},
          { headers: admin.headers }
        )
      )
    const returnable = async (orderId: string) =>
      (
        await http.get<{ window_open: boolean; lines: Line[] }>(
          `/admin/orders/${orderId}/returnable`,
          { headers: admin.headers }
        )
      ).data
    const cardsOf = async (lineId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "gift_card",
          fields: [
            "id",
            "value",
            "store_credit_account.id",
            "store_credit_account.balance",
            "store_credit_account.transactions.type",
            "store_credit_account.transactions.reference",
            "store_credit_account.transactions.reference_id",
          ],
          filters: { line_item_id: lineId },
        })
      return (data as unknown as Card[]).sort((a, b) => a.id.localeCompare(b.id))
    }

    /** A paid order of the customer's, `quantity` 500 TL cards on one line, its cards issued. */
    const giftOrder = async (quantity: number) => {
      const container = getContainer()
      const { variants } = await giftCardProduct(http, admin.headers, shop)
      const { cartId, lineOf } = await giftCart(container, shop, [
        { variant_id: variants["500"], quantity },
      ])
      await post(`/store/carts/${cartId}/line-items/${lineOf(variants["500"])}/gift`, {
        recipient_email: "zeynep.kaya@example.com",
      })
      await post(`/store/carts/${cartId}/payment-session`, { provider_id: BANK_TRANSFER })
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id: string }).id
      await container.resolve(Modules.ORDER).updateOrders(orderId, { customer_id: customer.id })
      await http.post(
        `/admin/orders/${orderId}/bank-transfer/confirm`,
        {},
        { headers: admin.headers }
      )
      await issueOrderGiftCards(container, orderId)
      const [line] = await orderLines(container, orderId)
      const lineId = line?.id ?? ""
      await eventually(
        () => cardsOf(lineId),
        (cards) => cards.length === quantity
      )
      return { orderId, lineId }
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      customer = await registerCustomer(http, store)
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
      await flag(true)
    })
    // The flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag(false)
    })

    it("takes an unused card back: returnable, its card voided on approval, the money given back", async () => {
      const { orderId, lineId } = await giftOrder(2)
      const before = await returnable(orderId)

      const asked = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "changed_mind",
      })
      const approved = await approve(asked.data.return_request.id)
      const cards = await cardsOf(lineId)
      const after = await returnable(orderId)
      const again = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "changed_mind",
      })

      expect(before.window_open).toBe(true)
      expect(before.lines).toEqual([
        expect.objectContaining({
          line_item_id: lineId,
          returnable: 2,
          gift_card: true,
          withdrawal_excluded: false,
          withdrawal_excluded_reason: null,
        }),
      ])
      expect(asked.data.return_request).toMatchObject({ status: "requested" })
      expect(approved.status).toBe(200)
      expect(approved.data.refund_error).toBeNull()
      expect(approved.data.return_request).toMatchObject({ status: "refunded" })
      expect(Number(approved.data.return_request.refund_amount)).toBe(500)
      // One card voided, its whole balance debited under the request; the other untouched
      expect(cards.map((card) => card.store_credit_account.balance).sort()).toEqual([0, 500])
      const voided = cards.find((card) => card.store_credit_account.balance === 0)
      expect(voided?.store_credit_account.transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "debit",
            reference: "return_request",
            reference_id: asked.data.return_request.id,
          }),
        ])
      )
      // A withdrawn card is no card spent: the other can still be withdrawn
      expect(after.lines[0]).toMatchObject({ returnable: 1, withdrawal_excluded: false })
      expect(again.data.return_request).toMatchObject({ status: "requested" })
    })

    it("keeps a line out once a card was spent, and refuses an approval when one was spent since", async () => {
      const container = getContainer()
      const spentOrder = await giftOrder(1)
      const later = await giftOrder(1)
      const spend = async (lineId: string) => {
        const [card] = await cardsOf(lineId)
        await debitAccountsWorkflow(container).run({
          input: [
            {
              account_id: card?.store_credit_account.id ?? "",
              amount: 100,
              reference: "cart",
              reference_id: "cart_test",
            },
          ],
        })
      }
      await spend(spentOrder.lineId)
      const lines = await returnable(spentOrder.orderId)
      const refused = await ask(spentOrder.orderId, {
        items: [{ line_item_id: spentOrder.lineId, quantity: 1 }],
        reason: "damaged",
      })
      const swap = await ask(later.orderId, {
        kind: "exchange",
        items: [{ line_item_id: later.lineId, quantity: 1, variant_id: "variant_x" }],
        reason: "changed_mind",
      })
      const asked = await ask(later.orderId, {
        items: [{ line_item_id: later.lineId, quantity: 1 }],
        reason: "changed_mind",
      })
      await spend(later.lineId)
      const approved = await approve(asked.data.return_request.id)
      const [card] = await cardsOf(later.lineId)

      expect(lines.lines[0]).toMatchObject({
        returnable: 0,
        gift_card: true,
        withdrawal_excluded: true,
        withdrawal_excluded_reason: "gift_card_used",
      })
      expect([refused.status, refused.data.message]).toEqual([400, "returns.gift_card_used"])
      expect([swap.status, swap.data.message]).toEqual([400, "returns.gift_card_separate"])
      expect([approved.status, approved.data.message]).toEqual([400, "returns.gift_card_used"])
      // Nothing voided: what is left stays the recipient's, the request still waits
      expect(card?.store_credit_account.balance).toBe(400)
      const { data } = await http.get<{ return_requests: Request[] }>(
        `/admin/return-requests?order_id=${later.orderId}`,
        { headers: admin.headers }
      )
      expect(data.return_requests[0]).toMatchObject({ status: "requested" })
    })
  },
})

import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { debitAccountsWorkflow } from "@medusajs/loyalty-plugin/workflows"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { issueOrderGiftCards } from "../../src/workflows/gift-cards/issue-and-send"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { cardsOfLine, giftCardProduct, orderLines } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface Returnable {
  window_open: boolean
  open_request: boolean
  lines: Record<string, unknown>[]
  message?: string
}

const LINE_FIELDS = [
  "gift_card",
  "line_item_id",
  "returnable",
  "title",
  "variant_id",
  "variant_title",
  "variants",
  "withdrawal_excluded",
  "withdrawal_excluded_reason",
  "withdrawal_warning",
]

/**
 * F18 (adr/0025, 2026-11-03): the order page learns what it may ask back,
 * and why a line is out, before the shopper sends the form; the order's
 * own customer or a guest with its key, as for its returns.
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
    const read = (orderId: string, path: "returnable" | "returns", headers = customer.headers) =>
      settle(http.get<Returnable>(`/store/orders/${orderId}/${path}`, { headers }))

    /** A paid order of a 250 and a 500 TL card, their cards issued; the customer's unless a guest's. */
    const giftOrder = async (owner: TestCustomer | null) => {
      const container = getContainer()
      const { variants } = await giftCardProduct(http, admin.headers, shop)
      const orderId = await placeOrder(container, {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        items: [
          { variant_id: variants["250"], quantity: 1 },
          { variant_id: variants["500"], quantity: 1 },
        ],
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
      if (owner) {
        await container.resolve(Modules.ORDER).updateOrders(orderId, { customer_id: owner.id })
      }
      const { data } = await query().graph({
        entity: "order",
        fields: ["cart.id", "payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const row = data[0] as {
        cart: { id: string }
        payment_collections: { payments: { id: string }[] }[]
      }
      await container
        .resolve(Modules.PAYMENT)
        .capturePayment({ payment_id: row.payment_collections[0]?.payments[0]?.id ?? "" })
      await issueOrderGiftCards(container, orderId)
      const lines = await orderLines(container, orderId)
      const lineOf = (variantId: string) =>
        lines.find((line) => line.variant_id === variantId)?.id ?? ""
      return {
        orderId,
        cartId: row.cart.id,
        small: lineOf(variants["250"]),
        big: lineOf(variants["500"]),
      }
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

    it("shows the customer each line, what is left and why a line is out, and nothing staff-only", async () => {
      const { orderId, small, big } = await giftOrder(customer)
      const [card] = await cardsOfLine(getContainer(), small)
      const { data } = await query().graph({
        entity: "gift_card",
        fields: ["store_credit_account.id"],
        filters: { id: card?.id ?? "" },
      })
      await debitAccountsWorkflow(getContainer()).run({
        input: [
          {
            account_id: (data[0] as { store_credit_account: { id: string } }).store_credit_account
              .id,
            amount: 50,
            reference: "cart",
            reference_id: "cart_test",
          },
        ],
      })

      const found = await read(orderId, "returnable")

      expect(found.status).toBe(200)
      expect(Object.keys(found.data).sort()).toEqual(["lines", "open_request", "window_open"])
      expect(found.data).toMatchObject({ window_open: true, open_request: false })
      for (const line of found.data.lines) {
        expect(Object.keys(line).sort()).toEqual(LINE_FIELDS)
      }
      const byId = new Map(found.data.lines.map((line) => [line["line_item_id"], line]))
      expect(byId.get(small)).toMatchObject({
        returnable: 0,
        gift_card: true,
        withdrawal_excluded: true,
        withdrawal_excluded_reason: "gift_card_used",
      })
      expect(byId.get(big)).toMatchObject({
        returnable: 1,
        gift_card: true,
        withdrawal_excluded: false,
        withdrawal_excluded_reason: null,
      })
    })

    it("answers another customer's order as its returns do, and a guest with the order's key", async () => {
      const someoneElse = await registerCustomer(http, store)
      const theirs = await giftOrder(someoneElse)
      const guest = await giftOrder(null)
      const { data: key } = await http.post<{ token: string }>(
        `/store/carts/${guest.cartId}/order-access`,
        {},
        { headers: store.headers }
      )
      const withKey = { ...store.headers, "x-order-token": key.token }

      const foreign = await read(theirs.orderId, "returnable")
      const foreignReturns = await read(theirs.orderId, "returns")
      const bare = await read(guest.orderId, "returnable", store.headers)
      const opened = await read(guest.orderId, "returnable", withKey)
      const openedReturns = await read(guest.orderId, "returns", withKey)

      expect(foreign.status).toBe(404)
      expect([foreign.status, foreign.data.message]).toEqual([
        foreignReturns.status,
        foreignReturns.data.message,
      ])
      expect(bare.status).toBe(404)
      expect([opened.status, openedReturns.status]).toEqual([200, 200])
      expect(opened.data.lines.map((line) => line["line_item_id"]).sort()).toEqual(
        [guest.small, guest.big].sort()
      )
    })
  },
})

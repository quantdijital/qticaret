import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { createAdminUser } from "../helpers/admin"
import { cardAccount, checkout, shippedCart } from "../helpers/gift-cards"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface GiftCard {
  id: string
  code: string
  value: number
  status: string
}

/** F4.8 (ADR-0025): gift cards through the loyalty plugin, behind the shop's flag. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    let variantId: string

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      shop = await stockShop(getContainer())
      variantId = (await stockedProduct(getContainer(), shop, "hediye-urun", 20, 300)).variantId
    })

    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )

    // The flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag(false)
    })

    const cart = () => shippedCart(getContainer(), shop, variantId)

    it("answers like a route that does not exist while the flag is off", async () => {
      const id = await cart()
      const asks = [
        http.get("/admin/gift-cards", { headers: admin.headers }),
        http.get("/admin/store-credit-accounts", { headers: admin.headers }),
        http.get("/store/gift-cards/GIFT-ABCD-EFGH-JKLM-NPQR", { headers: store.headers }),
        http.head("/store/gift-cards/GIFT-ABCD-EFGH-JKLM-NPQR", { headers: store.headers }),
        // Before the plugin's own sign-in check, which would answer 401
        http.get("/store/store-credit-accounts", { headers: store.headers }),
        http.post("/store/store-credit-accounts/claim", { code: "X" }, { headers: store.headers }),
        http.post(`/store/carts/${id}/store-credits`, {}, { headers: store.headers }),
        // An invalid body too: the gate answers before the plugin validates
        http.post(`/store/carts/${id}/gift-cards`, { nope: 1 }, { headers: store.headers }),
      ]
      for (const ask of await Promise.all(asks.map(settle))) {
        expect(ask.status).toBe(404)
      }
    })

    async function giftCard(value: number): Promise<GiftCard> {
      const made = await settle(
        http.post<{ gift_card: GiftCard }>(
          "/admin/gift-cards",
          { currency_code: "try", value },
          { headers: admin.headers }
        )
      )
      expect(made.status).toBe(200)
      return made.data.gift_card
    }

    const account = (cardId: string) => cardAccount(getContainer(), cardId)

    it("takes a gift card's value off what the customer pays", async () => {
      expect((await flag(true)).status).toBe(200)
      const card = await giftCard(100)
      expect(card.code).toMatch(/^GIFT(-[2-9A-HJ-NP-Z]{4}){4}$/u)
      const id = await cart()
      const added = await settle(
        http.post(`/store/carts/${id}/gift-cards`, { code: card.code }, { headers: store.headers })
      )
      expect(added.status).toBe(200)

      // 300 of goods and 90 shipping, 100 of it on the card
      const { orderId, paid } = await checkout(getContainer(), id)
      expect(paid).toBe(290)
      expect(await account(card.id)).toMatchObject({ balance: 0, debits: 100 })

      // The order's money, once delivery has made new versions of the order
      await advanceOrder(getContainer(), orderId, "delivered")
      const money = await http.get<{ money: Record<string, unknown> }>(
        `/admin/orders/${orderId}/money`,
        { headers: admin.headers }
      )
      expect(money.data.money).toMatchObject({
        net: "390.00",
        credit: "100.00",
        paid: "290.00",
        refundable: "290.00",
      })
    })

    it("keeps what a card has left for the next basket", async () => {
      await flag(true)
      const card = await giftCard(1000)
      const id = await cart()
      await http.post(
        `/store/carts/${id}/gift-cards`,
        { code: card.code },
        { headers: store.headers }
      )
      const { orderId, paid } = await checkout(getContainer(), id)
      expect(paid).toBe(0)
      // The 390 basket took 390 of the 1,000
      expect(await account(card.id)).toMatchObject({ balance: 610, debits: 390 })
      // As the panel's list reads it
      const list = await settle(
        http.get<{ gift_cards: { id: string; store_credit_account: { balance: number } }[] }>(
          "/admin/gift-cards?fields=id,code,value,store_credit_account.balance",
          { headers: admin.headers }
        )
      )
      expect(list.data.gift_cards.find((each) => each.id === card.id)).toMatchObject({
        store_credit_account: { balance: 610 },
      })
      // Paid in full by the card: the shop's to send, not waiting for a payment
      const state = await http.get<{ stage: string }>(`/admin/order-board/${orderId}`, {
        headers: admin.headers,
      })
      expect(state.data.stage).toBe("to_ship")
    })
  },
})

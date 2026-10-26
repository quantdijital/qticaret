import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

type Card = Record<string, unknown>

// What a shopper may see of a card (src/api/http/shopper-gift-cards.ts)
const SHOPPER_FIELDS = new Set([
  "id",
  "code",
  "status",
  "value",
  "currency_code",
  "expires_at",
  "created_at",
  "updated_at",
  "store_credit_account",
])

/** F4.8 (ADR-0025): gift card codes as a shop makes them and a shopper tries them. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      shop = await stockShop(getContainer())
      await flag(true)
    })

    // The flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag(false)
    })

    const giftCard = (body: Record<string, unknown>) =>
      settle(
        http.post<{ gift_card: { code: string } }>(
          "/admin/gift-cards",
          { currency_code: "try", value: 100, ...body },
          { headers: admin.headers }
        )
      )

    async function cart(): Promise<string> {
      const { variantId } = await stockedProduct(getContainer(), shop, "kod-urun", 20, 300)
      const { result } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
          items: [{ variant_id: variantId, quantity: 1 }],
        },
      })
      return result.id
    }

    const addCode = (cartPath: string, code: string) =>
      settle(
        http.post<{ cart: { gift_cards?: Card[] } }>(
          `/store/carts/${cartPath}/gift-cards`,
          { code },
          { headers: store.headers }
        )
      )
    const removeCode = (cartPath: string, code: string) =>
      settle(
        http.delete(`/store/carts/${cartPath}/gift-cards`, {
          headers: store.headers,
          data: { code },
        })
      )

    it("puts a shop's own word in front of the random part, never instead of it", async () => {
      const own = await giftCard({ code: "yılbaşı" })
      expect(own.data.gift_card.code).toMatch(/^YILBASI(-[2-9A-HJ-NP-Z]{4}){4}$/u)
      const refused = await giftCard({ code: "YIL BASI" })
      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ type: "invalid_data" })
    })

    it("takes a code typed in small letters, and limits the codes a cart may try", async () => {
      const { code } = (await giftCard({})).data.gift_card
      const id = await cart()
      expect((await addCode(id, code.toLowerCase())).status).toBe(200)
      const tries: number[] = []
      for (let attempt = 0; attempt < 10; attempt++) {
        // Taking a code off counts too, and the cart's id written escaped is the same cart
        const path = attempt % 2 === 0 ? id : id.replace("_", "%5F")
        const wrong = `GIFT-YOK${String(attempt)}`
        const answer = attempt < 5 ? await addCode(path, wrong) : await removeCode(path, wrong)
        tries.push(answer.status)
      }
      // Ten a cart in ten minutes, the one that worked among them
      expect(tries.slice(0, 9).every((status) => status !== 429)).toBe(true)
      expect(tries[9]).toBe(429)
    })

    it("shows a shopper the card, never the shop's note or its owner", async () => {
      const { code } = (await giftCard({ note: "Ayşe Hanım'a jest" })).data.gift_card
      for (const query of ["", "?fields=+note,+reference_id,+metadata,+store_credit_account.*"]) {
        const read = await settle(
          http.get<{ gift_card: Card }>(`/store/gift-cards/${code}${query}`, {
            headers: store.headers,
          })
        )
        expect(read.status).toBe(200)
        expect(read.data.gift_card).toMatchObject({ code, value: 100 })
        expect(Object.keys(read.data.gift_card).every((key) => SHOPPER_FIELDS.has(key))).toBe(true)
      }

      // The plugin's cart answer carries every field of its cards by default
      const id = await cart()
      const added = await addCode(id, code)
      const cards = added.data.cart.gift_cards ?? []
      expect(cards).toEqual([expect.objectContaining({ code })])
      expect(JSON.stringify(cards)).not.toMatch(/Ayşe|note|reference|metadata|customer/u)

      const cartWith = (fields: string) =>
        settle(
          http.get<{ cart: { gift_cards?: Card[] } }>(`/store/carts/${id}?fields=${fields}`, {
            headers: store.headers,
          })
        )
      const shown = await cartWith("id,gift_cards.code,gift_cards.store_credit_account.balance")
      expect(shown.data.cart.gift_cards).toEqual([
        expect.objectContaining({
          code,
          store_credit_account: expect.objectContaining({ balance: 100 }) as unknown,
        }),
      ])
      for (const fields of ["gift_cards.note", "*gift_cards", "+gift_cards.reference_id"]) {
        expect((await cartWith(fields)).status).toBe(400)
      }
    })

    it("keeps claiming a card by its account's code closed", async () => {
      const claim = await settle(
        http.post(
          "/store/store-credit-accounts/claim",
          { code: "SC-X" },
          { headers: store.headers }
        )
      )
      expect(claim.status).toBe(404)
    })
  },
})

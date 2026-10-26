import type { MedusaRequest } from "@medusajs/framework/http"
import {
  restrictStoreGiftCardFields,
  shopperGiftCard,
  shopperGiftCardAnswers,
} from "../shopper-gift-cards"
import { fakeResponse } from "./fakes"

const CARD = {
  id: "gcard_01A",
  code: "GIFT-ABCD-EFGH-JKLM-NPQR",
  status: "pending",
  value: 500,
  currency_code: "try",
  expires_at: null,
  note: "Ayşe Hanım'a şikâyet jesti",
  metadata: { internal: true },
  reference: "order",
  reference_id: "order_01X",
  line_item: { id: "ordli_01", unit_price: 500 },
  store_credit_account: { id: "sc_acc_01", balance: 120, customer_id: "cus_01", code: "SC-X" },
}

const SHOWN = {
  id: "gcard_01A",
  code: "GIFT-ABCD-EFGH-JKLM-NPQR",
  status: "pending",
  value: 500,
  currency_code: "try",
  expires_at: null,
  store_credit_account: { balance: 120 },
}

function answer(body: unknown): unknown {
  const response = fakeResponse()
  const next = jest.fn()
  shopperGiftCardAnswers({} as MedusaRequest, response.res, next)
  response.res.json(body)
  expect(next).toHaveBeenCalledTimes(1)
  return response.body()
}

describe("what a shopper sees of a gift card", () => {
  it("keeps the code, value, state, end and what its credit has left", () => {
    expect(shopperGiftCard(CARD)).toEqual(SHOWN)
  })

  it("cuts the plugin's answers down, whatever was asked for", () => {
    expect(answer({ gift_card: CARD })).toEqual({ gift_card: SHOWN })
    expect(answer({ cart: { id: "cart_01", total: 290, gift_cards: [CARD] } })).toEqual({
      cart: { id: "cart_01", total: 290, gift_cards: [SHOWN] },
    })
    const account = { store_credit_account: { id: "sc_acc_01", balance: 5 } }
    expect(answer(account)).toBe(account)
  })

  async function fieldsStatus(fields: string, on = true): Promise<number> {
    const response = fakeResponse()
    const next = jest.fn()
    const isFeatureEnabled = jest.fn(() => Promise.resolve(on))
    const req = {
      query: { fields },
      originalUrl: "/store/carts/cart_01",
      method: "GET",
      scope: { resolve: () => ({ isFeatureEnabled }) },
    }
    await restrictStoreGiftCardFields(req as unknown as MedusaRequest, response.res, next)
    return next.mock.calls.length > 0 ? 200 : response.status()
  }

  it.each([
    ["gift_cards.code,gift_cards.store_credit_account.balance", 200],
    ["+gift_cards.value", 200],
    ["gift_cards.note", 400],
    ["*gift_cards", 400],
    ["gift_cards", 400],
    ["gift_cards.*", 400],
    ["GIFT_CARDS.note", 400],
    ["+gift_cards.store_credit_account.customer_id", 400],
    ["gift_cards.store_credit_account.id", 400],
    ["items.gift_cards.metadata", 400],
    ["id,total", 200],
  ])("Store fields %s: %s", async (fields, status) => {
    expect(await fieldsStatus(fields)).toBe(status)
  })

  it("refuses every field of a card while the feature is off", async () => {
    expect(await fieldsStatus("gift_cards.code", false)).toBe(400)
    expect(await fieldsStatus("id,total", false)).toBe(200)
  })
})

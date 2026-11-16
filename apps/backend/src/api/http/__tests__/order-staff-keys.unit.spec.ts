import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { hideStaffOrderKeys } from "../order-staff-keys"

function answer(body: unknown): unknown {
  let sent: unknown
  const res = {
    json: (value: unknown) => {
      sent = value
      return res
    },
  }
  hideStaffOrderKeys({} as MedusaRequest, res as unknown as MedusaResponse, () => undefined)
  res.json(body)
  return sent
}

describe("hideStaffOrderKeys", () => {
  it("drops the link's maker from an order and from a list, and keeps the rest", () => {
    const metadata = () => ({
      qt_payment_link: "plink_1",
      qt_payment_link_number: 1042,
      qt_payment_link_by: "user_1",
      gift_note: "kept",
    })
    const kept = { qt_payment_link: "plink_1", qt_payment_link_number: 1042, gift_note: "kept" }

    expect(answer({ order: { id: "order_1", metadata: metadata() } })).toEqual({
      order: { id: "order_1", metadata: kept },
    })
    expect(
      answer({ orders: [{ id: "order_1", metadata: metadata() }, { id: "order_2" }] })
    ).toEqual({ orders: [{ id: "order_1", metadata: kept }, { id: "order_2" }] })
    expect(answer({ type: "cart", cart: { id: "cart_1" } })).toEqual({
      type: "cart",
      cart: { id: "cart_1" },
    })
  })
})

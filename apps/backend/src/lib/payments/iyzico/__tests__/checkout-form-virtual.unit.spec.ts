import { kurus } from "../../../money"
import { paymentBasket } from "../../basket"
import { hostedCheckout } from "../../checkout"
import type { HostedCheckout } from "../../checkout"
import { checkoutFormRequest } from "../checkout-form"

const SESSION = "payses_01K8ZB2X9Q6J4V7W3N5R0T1Y2Z"

const checkout = (basket: HostedCheckout["basket"]): HostedCheckout => ({
  email: "ayse.yilmaz@example.com",
  buyer: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "0532 000 00 00",
    address_1: "Atatürk Cad. No: 1",
    city: "Kadıköy",
    province: "İstanbul",
    postal_code: "34710",
    country_code: "tr",
  },
  ip: "85.34.78.112",
  return_urls: {
    success: "http://localhost:8000/odeme/tamam",
    failure: "http://localhost:8000/odeme/hata",
  },
  basket,
})

const request = (basket: HostedCheckout["basket"], amount: number) =>
  checkoutFormRequest({
    sessionId: SESSION,
    amount: kurus(amount),
    currencyCode: "try",
    checkout: checkout(basket),
    callbackUrl: `http://localhost:9000/hooks/iyzico/callback?session=${SESSION}`,
    installments: { enabled: true, max: 6 },
  })

/** adr/0076 §6: an item nothing ships for goes to iyzico as virtual. */
describe("iyzico basket items nothing ships for", () => {
  it("names a digital or service item VIRTUAL, a shipped item and the shipping PHYSICAL", () => {
    const form = request(
      [
        { id: "cali_1", kind: "item", name: "Kupa", quantity: 1, amount: 24000 },
        { id: "cali_2", kind: "item", name: "Atölye", quantity: 1, amount: 50000, ships: false },
        { id: "shipping", kind: "shipping", name: "Kargo", quantity: 1, amount: 9050 },
      ],
      83050
    )

    expect(form["basketItems"]).toEqual([
      { id: "cali_1", name: "Kupa", category1: "Ürün", itemType: "PHYSICAL", price: "240.00" },
      { id: "cali_2", name: "Atölye", category1: "Ürün", itemType: "VIRTUAL", price: "500.00" },
      { id: "shipping", name: "Kargo", category1: "Kargo", itemType: "PHYSICAL", price: "90.50" },
    ])
  })

  it("keeps sending one address as shipping and billing for an all-virtual basket", () => {
    const form = request(
      [
        {
          id: "cali_1",
          kind: "item",
          name: "Hediye kartı",
          quantity: 1,
          amount: 50000,
          ships: false,
        },
      ],
      50000
    )

    expect(form["basketItems"]).toEqual([
      {
        id: "cali_1",
        name: "Hediye kartı",
        category1: "Ürün",
        itemType: "VIRTUAL",
        price: "500.00",
      },
    ])
    expect(form["shippingAddress"]).toEqual(form["billingAddress"])
  })

  it("keeps the mark through the stored session's parse, absent for a shipped line", () => {
    const parsed = hostedCheckout.parse(
      checkout([
        { id: "cali_1", kind: "item", name: "Kupa", quantity: 1, amount: 24000 },
        { id: "cali_2", kind: "item", name: "Atölye", quantity: 1, amount: 50000, ships: false },
      ])
    )

    expect(parsed.basket[0]).not.toHaveProperty("ships")
    expect(parsed.basket[1]).toMatchObject({ ships: false })
  })

  it("carries the mark from the cart's lines into the basket, only where it is false", () => {
    const basket = paymentBasket(
      [
        { id: "cali_1", kind: "item", quantity: 1, net: kurus(24000), name: "Kupa", ships: true },
        {
          id: "cali_2",
          kind: "item",
          quantity: 1,
          net: kurus(50000),
          name: "Atölye",
          ships: false,
        },
        { id: "shipping", kind: "shipping", quantity: 1, net: kurus(9050), name: "Kargo" },
      ],
      kurus(83050)
    )

    expect(basket).toEqual([
      { id: "cali_1", kind: "item", name: "Kupa", quantity: 1, amount: 24000 },
      { id: "cali_2", kind: "item", name: "Atölye", quantity: 1, amount: 50000, ships: false },
      { id: "shipping", kind: "shipping", name: "Kargo", quantity: 1, amount: 9050 },
    ])
  })
})

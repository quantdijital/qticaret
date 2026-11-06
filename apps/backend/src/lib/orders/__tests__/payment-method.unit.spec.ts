import { paymentMethodOf } from "../payment-method"

const paid = (...providers: string[]) => ({
  payment_collections: [{ payments: providers.map((provider_id) => ({ provider_id })) }],
})

describe("paymentMethodOf", () => {
  it("names a card, a transfer and a payment at the door by their provider", () => {
    expect(paymentMethodOf(paid("pp_paytr_paytr"))).toBe("card")
    expect(paymentMethodOf(paid("pp_iyzico_iyzico"))).toBe("card")
    expect(paymentMethodOf(paid("pp_bank-transfer_bank-transfer"))).toBe("bank_transfer")
    expect(paymentMethodOf(paid("pp_cod_cod"))).toBe("cod")
  })

  it("names a payment link's order by the link, whatever paid it", () => {
    expect(
      paymentMethodOf({ ...paid("pp_paytr_paytr"), metadata: { qt_payment_link: "plink_1" } })
    ).toBe("payment_link")
    expect(paymentMethodOf({ ...paid("pp_paytr_paytr"), metadata: { qt_payment_link: "" } })).toBe(
      "card"
    )
  })

  it("puts what the buyer paid with before a gift card paying part", () => {
    expect(paymentMethodOf(paid("pp_gift-card_gift-card", "pp_paytr_paytr"))).toBe("card")
    expect(paymentMethodOf(paid("pp_gift-card_gift-card"))).toBe("gift_card")
  })

  it("reads the session the shopper chose while no payment exists, never one left behind", () => {
    expect(
      paymentMethodOf({
        payment_collections: [
          {
            payments: [],
            payment_sessions: [
              { provider_id: "pp_paytr_paytr", status: "error" },
              { provider_id: "pp_bank-transfer_bank-transfer", status: "authorized" },
            ],
          },
        ],
      })
    ).toBe("bank_transfer")
  })

  it("calls a provider the shop has none of, or nothing, other", () => {
    expect(paymentMethodOf(paid("pp_system_default"))).toBe("other")
    expect(paymentMethodOf({})).toBe("other")
    expect(paymentMethodOf({ payment_collections: [null] })).toBe("other")
  })
})

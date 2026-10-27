import { kurus, sumKurus } from "../../../money"
import { BasketMismatch, paymentBasket } from ".."

const line = (id: string, net: number, kind: "item" | "shipping" = "item", quantity = 1) => ({
  id,
  kind,
  name: id,
  quantity,
  net: kurus(net),
})

describe("paymentBasket (adr/0026)", () => {
  it("keeps every line as it costs when nothing is paid by credit", () => {
    const basket = paymentBasket(
      [line("kupa", 2400, "item", 2), line("kargo", 1056, "shipping")],
      kurus(3456)
    )

    expect(basket).toEqual([
      { id: "kupa", kind: "item", name: "kupa", quantity: 2, amount: kurus(2400) },
      { id: "kargo", kind: "shipping", name: "kargo", quantity: 1, amount: kurus(1056) },
    ])
  })

  it("spreads store credit over the lines and still adds up to the payment, to the kuruş", () => {
    const lines = [line("a", 1000), line("b", 333), line("kargo", 999, "shipping")]
    const basket = paymentBasket(lines, kurus(1700))

    expect(sumKurus(basket.map((entry) => entry.amount))).toBe(1700)
    for (const entry of basket) {
      expect(entry.amount).toBeGreaterThan(0)
      expect(entry.amount).toBeLessThanOrEqual(lines.find((each) => each.id === entry.id)?.net ?? 0)
    }
  })

  it("leaves out lines at 0 TL: a free item, or one credit paid in full", () => {
    expect(
      paymentBasket([line("hediye", 0), line("kupa", 500)], kurus(500)).map((entry) => entry.id)
    ).toEqual(["kupa"])
    const paidByCredit = paymentBasket([line("a", 1), line("b", 999)], kurus(990))
    expect(paidByCredit.every((entry) => entry.amount > 0)).toBe(true)
    expect(sumKurus(paidByCredit.map((entry) => entry.amount))).toBe(990)
  })

  it("refuses a payment the lines cannot add up to", () => {
    expect(() => paymentBasket([line("a", 500)], kurus(600))).toThrow(BasketMismatch)
    expect(() => paymentBasket([line("a", 500)], kurus(0))).toThrow(BasketMismatch)
  })
})

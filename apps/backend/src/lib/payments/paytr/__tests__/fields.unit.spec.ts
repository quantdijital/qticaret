import { kurus } from "../../../money"
import { paytrBasketOf } from "../fields"

describe("paytrBasketOf", () => {
  it("lists a unit price when the quantity divides the line, else the whole line once", () => {
    expect(
      paytrBasketOf([
        { name: "Kupa", quantity: 2, amount: kurus(2400) },
        { name: "Tabak", quantity: 3, amount: kurus(1000) },
      ])
    ).toEqual([
      { name: "Kupa", price: kurus(1200), quantity: 2 },
      { name: "Tabak (3 adet)", price: kurus(1000), quantity: 1 },
    ])
  })
})

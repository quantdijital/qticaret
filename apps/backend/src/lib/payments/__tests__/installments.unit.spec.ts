import { kurus } from "../../money"
import { installmentLimit, installmentTable } from "../installments"

describe("installments (F5 V6)", () => {
  it("adds each count's surcharge to the whole amount, one payment first", () => {
    const table = installmentTable(kurus(100000), { bonus: { 2: 3.5, 3: 4.2, 9: 11 } }, 6)

    expect(table).toEqual([
      {
        family: "bonus",
        options: [
          { count: 1, rate: 0, total: kurus(100000), per_installment: kurus(100000) },
          { count: 2, rate: 3.5, total: kurus(103500), per_installment: kurus(51750) },
          { count: 3, rate: 4.2, total: kurus(104200), per_installment: kurus(34733) },
        ],
      },
    ])
  })

  it("offers no more than the shop chose, nor than the provider allows", () => {
    expect(installmentLimit(0, 9)).toBe(9)
    expect(installmentLimit(6, 9)).toBe(6)
    expect(installmentLimit(12, 6)).toBe(6)
    expect(installmentLimit(0, null)).toBe(12)
  })

  it("leaves out a card family with nothing past one payment", () => {
    expect(installmentTable(kurus(5000), { world: { 9: 11 } }, 6)).toEqual([])
  })
})

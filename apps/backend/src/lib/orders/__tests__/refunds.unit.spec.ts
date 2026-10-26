import { kurus } from "../../money"
import { paidForUnits, returnRefund, spreadRefund, unitsRefund } from ".."
import type { LineShare } from ".."

// 3 × 33.33 with 10.00 of the order's discount on it (F4.7 KK)
const line: LineShare = {
  id: "a",
  kind: "item",
  quantity: 3,
  gross: kurus(9999),
  discount: kurus(1000),
  net: kurus(8999),
}
const other: LineShare = {
  id: "b",
  kind: "item",
  quantity: 1,
  gross: kurus(2000),
  discount: kurus(200),
  net: kurus(1800),
}
const shippingLine: LineShare = { ...other, id: "s", kind: "shipping" }

describe("unitsRefund", () => {
  it("gives back a unit's payment, its discount share taken out (KK)", () => {
    expect(unitsRefund(line, 0, 1)).toEqual({
      id: "a",
      quantity: 1,
      gross: 3333,
      discount: 333,
      net: 3000,
    })
  })

  it("adds up to the line's payment when units come back one by one", () => {
    const steps = [0, 1, 2].map((before) => unitsRefund(line, before, 1))
    expect(steps.map((step) => step.net)).toEqual([3000, 2999, 3000])
    expect(steps.reduce((sum, step) => sum + step.net, 0)).toBe(8999)
    expect(steps.reduce((sum, step) => sum + step.discount, 0)).toBe(1000)
  })

  it("gives the same total however the units are grouped", () => {
    const oneThenTwo = unitsRefund(line, 0, 1).net + unitsRefund(line, 1, 2).net
    const twoThenOne = unitsRefund(line, 0, 2).net + unitsRefund(line, 2, 1).net
    expect(oneThenTwo).toBe(8999)
    expect(twoThenOne).toBe(8999)
    expect(unitsRefund(line, 0, 3).net).toBe(8999)
  })

  it("keeps each unit's discount at or above zero when the price does not split evenly", () => {
    // A price with tax added on: 3.02 over three units, 0.01 of it discounted
    const uneven: LineShare = { ...line, gross: kurus(302), discount: kurus(1), net: kurus(301) }
    const steps = [0, 1, 2].map((before) => unitsRefund(uneven, before, 1))
    expect(steps.map((step) => [step.gross, step.discount, step.net])).toEqual([
      [100, 0, 100],
      [102, 1, 101],
      [100, 0, 100],
    ])
  })

  it("adds up and never goes below zero on random lines, however the units come back", () => {
    // Park–Miller: the same 500 lines on every run
    let seed = 7
    const next = (limit: number): number => {
      seed = (seed * 48_271) % 2_147_483_647
      return seed % limit
    }
    for (let run = 0; run < 500; run++) {
      const quantity = 1 + next(7)
      // Half of them priced in whole kuruş per unit, as prices are entered
      const gross = next(2) === 0 ? quantity * (1 + next(10_000)) : 1 + next(70_000)
      const discount = next(gross + 1)
      const random: LineShare = {
        id: "r",
        kind: "item",
        quantity,
        gross: kurus(gross),
        discount: kurus(discount),
        net: kurus(gross - discount),
      }
      const steps = []
      for (let before = 0; before < quantity;) {
        const units = Math.min(1 + next(3), quantity - before)
        steps.push(unitsRefund(random, before, units))
        before += units
      }
      steps.forEach((step) => {
        expect(step.discount).toBeGreaterThanOrEqual(0)
        expect(step.net).toBeGreaterThanOrEqual(0)
        expect(step.gross).toBe(step.discount + step.net)
      })
      expect(steps.reduce((sum, step) => sum + step.net, 0)).toBe(random.net)
      expect(steps.reduce((sum, step) => sum + step.discount, 0)).toBe(random.discount)
    }
  })

  it("gives nothing back on a line with no units left", () => {
    const empty: LineShare = { ...line, quantity: 0 }
    expect(unitsRefund(empty, 0, 0)).toMatchObject({ gross: 0, discount: 0, net: 0 })
    expect(paidForUnits(empty, 0)).toBe(0)
  })

  it.each([
    ["more units than the line holds", 2, 2],
    ["a negative count", -1, 1],
    ["a fractional count", 0, 1.5],
  ])("rejects %s", (_case, before, units) => {
    expect(() => unitsRefund(line, before, units)).toThrow(RangeError)
  })
})

describe("returnRefund", () => {
  it("counts each line's units after those that came back before", () => {
    const refund = returnRefund([line, other, shippingLine], new Map([["a", 1]]), [
      { id: "a", quantity: 1 },
      { id: "b", quantity: 1 },
    ])
    expect(refund.lines.map((each) => each.net)).toEqual([2999, 1800])
    expect(refund.total).toBe(4799)
  })

  it("counts a line named twice once, with both counts", () => {
    const refund = returnRefund([line], new Map(), [
      { id: "a", quantity: 1 },
      { id: "a", quantity: 2 },
    ])
    expect(refund.lines).toHaveLength(1)
    expect(refund.total).toBe(8999)
  })

  it("refuses a line the order does not have, or its shipping", () => {
    expect(() => returnRefund([line], new Map(), [{ id: "x", quantity: 1 }])).toThrow(RangeError)
    expect(() => returnRefund([shippingLine], new Map(), [{ id: "s", quantity: 1 }])).toThrow(
      RangeError
    )
  })
})

describe("spreadRefund", () => {
  it("spreads an amount by what each line still holds", () => {
    expect(
      spreadRefund(kurus(5000), [
        { id: "a", remaining: kurus(1000) },
        { id: "b", remaining: kurus(10_000) },
      ])
    ).toEqual([
      { id: "a", net: 455 },
      { id: "b", net: 4545 },
    ])
  })

  it("empties every line when it is all that is left", () => {
    const parts = spreadRefund(kurus(1001), [
      { id: "a", remaining: kurus(1) },
      { id: "b", remaining: kurus(1000) },
    ])
    expect(parts.map((part) => part.net)).toEqual([1, 1000])
  })

  it("refuses more than the lines hold", () => {
    expect(() => spreadRefund(kurus(11), [{ id: "a", remaining: kurus(10) }])).toThrow(RangeError)
  })
})

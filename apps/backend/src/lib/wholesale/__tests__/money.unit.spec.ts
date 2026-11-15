import { kurus } from "../../money"
import {
  MAX_RATE_BPS,
  bpsToPercent,
  grossOfNet,
  netOfGross,
  percentToBps,
  ratePrice,
  vatBps,
} from "../money"

describe("wholesale rate prices (ADR-0068 §4, adr/0010)", () => {
  it("takes the rate off the own price, half-up to the kuruş, as a price list's percentage", () => {
    // 33.33 less 15% is 28.3305
    expect(ratePrice(kurus(3333), 1500)).toBe(2833)
    // 100.00 less 12.5% is 87.50
    expect(ratePrice(kurus(10_000), 1250)).toBe(8750)
    // 0.05 less 50% is 0.025: half-up to 0.03
    expect(ratePrice(kurus(5), 5000)).toBe(3)
    expect(ratePrice(kurus(10_000), MAX_RATE_BPS)).toBe(100)
  })

  it("refuses a rate of none, of everything or past 99%", () => {
    for (const rate of [0, -1, 9_901, 10_000, 12.5]) {
      expect(() => ratePrice(kurus(10_000), rate)).toThrow(RangeError)
    }
  })

  it("reads a percentage with two decimals as basis points and back", () => {
    expect(percentToBps(12.5)).toBe(1250)
    expect(percentToBps(0.01)).toBe(1)
    expect(percentToBps(99)).toBe(9_900)
    // 0.07 × 100 is 7.000000000000001 in floating point
    expect(percentToBps(0.07)).toBe(7)
    expect(bpsToPercent(1250)).toBe(12.5)
  })
})

describe("KDV excluded and included (adr/0007)", () => {
  it("works the gross price out of the net one, half-up", () => {
    expect(grossOfNet(kurus(100_000), vatBps(20))).toBe(120_000)
    // 8.33 × 1.2 = 9.996
    expect(grossOfNet(kurus(833), vatBps(20))).toBe(1000)
    // 0.01 × 1.01 = 0.0101
    expect(grossOfNet(kurus(1), vatBps(1))).toBe(1)
    expect(grossOfNet(kurus(1234), 0)).toBe(1234)
  })

  it("works the net price out of the gross one, half-up", () => {
    expect(netOfGross(kurus(120_000), vatBps(20))).toBe(100_000)
    // 10.00 / 1.2 = 8.3333…
    expect(netOfGross(kurus(1000), vatBps(20))).toBe(833)
    expect(netOfGross(kurus(1234), 0)).toBe(1234)
  })

  it("brings every net price back to itself through the gross one, at every KDV rate", () => {
    for (const rate of [0, 1, 8, 10, 18, 20, 0.5, 26.5]) {
      const vat = vatBps(rate)
      for (let net = 0; net <= 20_000; net++) {
        const amount = kurus(net)
        expect(netOfGross(grossOfNet(amount, vat), vat)).toBe(amount)
      }
      for (const net of [999_999_99, 123_456_789, 1_000_000_00]) {
        expect(netOfGross(grossOfNet(kurus(net), vat), vat)).toBe(net)
      }
    }
  })

  it("refuses a KDV rate that is not whole basis points", () => {
    expect(() => grossOfNet(kurus(100), 20.5)).toThrow(RangeError)
    expect(() => netOfGross(kurus(100), -1)).toThrow(RangeError)
  })

  it("reads a KDV rate in percent as basis points", () => {
    expect(vatBps(20)).toBe(2000)
    expect(vatBps(1)).toBe(100)
    expect(vatBps(0.5)).toBe(50)
  })
})

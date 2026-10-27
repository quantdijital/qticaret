import { kurus } from "../../../money"
import { parsePaytrKurus, parsePaytrLira, toPaytrKurus, toPaytrLira } from "../amounts"

describe("PayTR amount formats", () => {
  it("writes the token amount in whole kuruş and basket or refund amounts in lira", () => {
    expect(toPaytrKurus(kurus(3456))).toBe("3456")
    expect(toPaytrLira(kurus(1800))).toBe("18.00")
    expect(toPaytrLira(kurus(1197))).toBe("11.97")
    expect(toPaytrLira(kurus(5))).toBe("0.05")
  })

  it.each([0, -100])("refuses %p, PayTR takes positive amounts only", (value) => {
    expect(() => toPaytrKurus(kurus(value))).toThrow(RangeError)
    expect(() => toPaytrLira(kurus(value))).toThrow(RangeError)
  })

  it("reads whole kuruş from a notification", () => {
    expect(parsePaytrKurus("3456")).toBe(3456)
  })

  it.each(["34.56", "-1", "", "1e3", " 12"])("refuses %p as whole kuruş", (value) => {
    expect(() => parsePaytrKurus(value)).toThrow(RangeError)
  })

  it.each([
    ["10,8", 1080],
    ["9.76", 976],
    ["10", 1000],
    ["0,05", 5],
    [12.5, 1250],
  ])("reads the status query's %p as %p kuruş", (value, expected) => {
    expect(parsePaytrLira(value)).toBe(expected)
  })

  it.each(["1.234,56", "10,805", "abc", "-5", ""])("refuses %p rather than guess", (value) => {
    expect(() => parsePaytrLira(value)).toThrow(RangeError)
  })
})

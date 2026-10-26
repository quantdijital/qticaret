import { describe, expect, it } from "vitest"
import { currencySymbol, formatPhone } from "./format"

describe("formatPhone", () => {
  it("groups a Turkish number as people write it", () => {
    expect(formatPhone("+902165551234")).toBe("+90 216 555 12 34")
    expect(formatPhone("+905321234567")).toBe("+90 532 123 45 67")
  })

  it("keeps any other number as stored", () => {
    expect(formatPhone("+4930123456")).toBe("+4930123456")
    expect(formatPhone("0216 555")).toBe("0216 555")
  })
})

describe("currencySymbol", () => {
  it("names the sign a money field shows", () => {
    expect(currencySymbol("try")).toBe("₺")
    expect(currencySymbol("EUR")).toBe("€")
  })
})

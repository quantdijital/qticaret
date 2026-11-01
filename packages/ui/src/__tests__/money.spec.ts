import { describe, expect, it } from "vitest"
import { formatLira } from "../money"

describe("formatLira", () => {
  it("writes lira the Turkish way, from numbers and the API's strings", () => {
    expect(formatLira(1250)).toBe("1.250,00 TL")
    expect(formatLira("80.00")).toBe("80,00 TL")
    expect(formatLira(0.5)).toBe("0,50 TL")
  })

  it("shows nothing odd for a value that is not a number", () => {
    expect(formatLira("abc")).toBe("0,00 TL")
  })
})

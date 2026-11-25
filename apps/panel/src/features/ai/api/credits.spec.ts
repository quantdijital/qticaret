import { describe, expect, it } from "vitest"
import { formatMinorMoney } from "./credits"

/** A pack's price as the server sends it (kuruş), written in the panel's language (#381 review). */
describe("formatMinorMoney", () => {
  it("writes it the Turkish way in Turkish", () => {
    expect(formatMinorMoney(25_000, "TRY", "tr")).toBe("₺250,00")
  })

  it("writes it the English way in English", () => {
    expect(formatMinorMoney(25_000, "TRY", "en")).toBe("TRY 250.00")
    expect(formatMinorMoney(1_999, "usd", "en")).toBe("$19.99")
  })

  it("falls back to Turkish for any other language", () => {
    expect(formatMinorMoney(25_000, "TRY", "de")).toBe("₺250,00")
    expect(formatMinorMoney(25_000, "TRY", undefined)).toBe("₺250,00")
  })
})

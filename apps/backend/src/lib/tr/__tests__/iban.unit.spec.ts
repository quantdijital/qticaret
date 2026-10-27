import { formatIban, isValidTrIban, normalizeIban } from "../iban"

// The check digits of a made-up account, worked out by mod-97 (ISO 13616)
const VALID = "TR330006100519786457841326"

describe("Turkish IBAN", () => {
  it("accepts a TR IBAN whose check digits hold, written any way", () => {
    expect(isValidTrIban(VALID)).toBe(true)
    expect(isValidTrIban("tr33 0006 1005 1978 6457 8413 26")).toBe(true)
  })

  it("refuses a wrong check, a wrong length and another country", () => {
    expect(isValidTrIban("TR340006100519786457841326")).toBe(false)
    expect(isValidTrIban("TR33000610051978645784132")).toBe(false)
    expect(isValidTrIban("DE89370400440532013000")).toBe(false)
  })

  it("stores without spaces and prints in groups of four", () => {
    expect(normalizeIban(" tr33 0006 ")).toBe("TR330006")
    expect(formatIban(VALID)).toBe("TR33 0006 1005 1978 6457 8413 26")
  })
})

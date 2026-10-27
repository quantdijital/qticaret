import { describe, expect, it } from "vitest"
import { formatIban, isValidTrIban } from "./iban"

describe("Turkish IBAN", () => {
  it("accepts a TR IBAN whose check digits hold, written any way, and prints it in fours", () => {
    expect(isValidTrIban("tr33 0006 1005 1978 6457 8413 26")).toBe(true)
    expect(formatIban("TR330006100519786457841326")).toBe("TR33 0006 1005 1978 6457 8413 26")
  })

  it("refuses a wrong check digit and another country", () => {
    expect(isValidTrIban("TR340006100519786457841326")).toBe(false)
    expect(isValidTrIban("DE89370400440532013000")).toBe(false)
  })
})

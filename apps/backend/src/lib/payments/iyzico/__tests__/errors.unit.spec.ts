import { ProviderError } from "../../../errors"
import { iyzicoError, nothingDone, refundPartNotMade } from "../errors"

const client = (providerCode: string) =>
  new ProviderError({ provider: "iyzico", providerCode, retryable: false })

describe("an iyzico call that surely did nothing (F5 V10, review D4-3)", () => {
  it("is iyzico's own refusal, or a call that never left", () => {
    expect(nothingDone(iyzicoError("5093"))).toBe(true)
    expect(nothingDone(client("network_error"))).toBe(true)
    expect(nothingDone(client("circuit_open"))).toBe(true)
  })

  it("is never a refused redirect, an unread answer or a lost one: the money may have moved", () => {
    expect(nothingDone(client("url_not_allowed"))).toBe(false)
    expect(nothingDone(client("invalid_response"))).toBe(false)
    expect(nothingDone(client("outcome_unknown"))).toBe(false)
    // An iyzico code not from iyzico's own answer
    expect(nothingDone(client("5093"))).toBe(false)
  })
})

describe("a refund part surely not made (review D4-1, S2)", () => {
  it.each(["5093", "10245", "10223", "10237"])("is iyzico's known refusal %s", (code) => {
    expect(refundPartNotMade(iyzicoError(code))).toBe(true)
  })

  it("is a call that never left", () => {
    expect(refundPartNotMade(client("network_error"))).toBe(true)
    expect(refundPartNotMade(client("circuit_open"))).toBe(true)
  })

  it("is never any other refusal: iyzico keeps no refund list to read the part back from", () => {
    for (const code of ["1", "99", "10051", "FAKE_X", undefined]) {
      expect(refundPartNotMade(iyzicoError(code))).toBe(false)
    }
    expect(refundPartNotMade(client("refund_exceeds_line"))).toBe(false)
    expect(refundPartNotMade(client("outcome_unknown"))).toBe(false)
    expect(refundPartNotMade(new Error("x"))).toBe(false)
  })
})

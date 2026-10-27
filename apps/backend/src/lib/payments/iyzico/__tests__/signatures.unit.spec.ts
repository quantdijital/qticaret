import { fakeIyzicoAccount, iyzicoSign, readAuthorization } from "@qticaret/testing"
import {
  authorizationHeader,
  isResponseGenuine,
  newRandomKey,
  requestSignature,
  responseSignature,
  signaturePrice,
  signedHeaders,
} from "../signatures"

describe("iyzico signatures", () => {
  it("builds the Authorization header of docs.iyzico.com's worked example", () => {
    // "HMACSHA256 Auth" (2026-10-27): the doc's sandbox example, public, no secret key given
    const header = authorizationHeader(
      "sandbox-3uHv0LccjcWDyFHTvJpiACKPcJwbczmZ", // gitleaks:allow
      "1722246017090123456789",
      "91e491486d3aa951b4f387cc93d67fc754c4729af95344b694435f56447819e9" // gitleaks:allow
    )

    expect(header).toBe(
      [
        "IYZWSv2 YXBpS2V5OnNhbmRib3gtM3VIdjBMY2NqY1dEeUZIVHZKcGlBQ0tQY0p3YmN6bVomcmFuZG9tS2V5OjE3MjIyNDYwMTcw", // gitleaks:allow
        "OTAxMjM0NTY3ODkmc2lnbmF0dXJlOjkxZTQ5MTQ4NmQzYWE5NTFiNGYzODdjYzkzZDY3ZmM3NTRjNDcyOWFmOTUzNDRi", // gitleaks:allow
        "Njk0NDM1ZjU2NDQ3ODE5ZTk=",
      ].join("")
    )
  })

  it("signs random key, path and body as the documentation does", () => {
    const account = fakeIyzicoAccount()
    const body = JSON.stringify({ locale: "tr", conversationId: "c1", price: "1.0" })

    expect(
      requestSignature(account.secretKey, "123456789", "/payment/iyzipos/installment", body)
    ).toBe(iyzicoSign(account.secretKey, "123456789", "/payment/iyzipos/installment", body))
  })

  it("puts the same random key in the header and in x-iyzi-rnd", () => {
    const account = fakeIyzicoAccount()
    const headers = signedHeaders(account, "/payment/iyzipos/installment", "{}", "42")

    expect(headers["x-iyzi-rnd"]).toBe("42")
    expect(readAuthorization(headers["authorization"])).toEqual({
      apiKey: account.apiKey,
      randomKey: "42",
      signature: iyzicoSign(account.secretKey, "42", "/payment/iyzipos/installment", "{}"),
    })
  })

  it("draws a new random key of digits each time", () => {
    const keys = new Set(Array.from({ length: 20 }, newRandomKey))

    expect(keys.size).toBe(20)
    for (const key of keys) {
      expect(key).toMatch(/^\d{22}$/)
    }
  })

  it("writes prices in responses without trailing zeros", () => {
    expect(signaturePrice("10.50")).toBe("10.5")
    expect(signaturePrice("10.0")).toBe("10")
    expect(signaturePrice("100.00")).toBe("100")
    expect(signaturePrice("100")).toBe("100")
    expect(signaturePrice(1.25)).toBe("1.25")
  })

  it("accepts only a response signed with the account's secret key", () => {
    const { secretKey } = fakeIyzicoAccount()
    const values = ["SUCCESS", "12345", "TRY", "B1", "C1", "10.5", "10.5", "tok"]
    const signature = responseSignature(secretKey, values)

    expect(isResponseGenuine(secretKey, values, signature)).toBe(true)
    expect(
      isResponseGenuine(secretKey, [...values.slice(0, 5), "11", "10.5", "tok"], signature)
    ).toBe(false)
    expect(isResponseGenuine(fakeIyzicoAccount().secretKey, values, signature)).toBe(false)
    expect(isResponseGenuine(secretKey, values, undefined)).toBe(false)
  })
})

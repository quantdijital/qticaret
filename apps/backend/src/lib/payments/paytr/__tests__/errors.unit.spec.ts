import { ProviderError } from "../../../errors"
import { paytrError, paytrErrorCode, tokenFailureCode } from "../errors"

describe("PayTR error codes", () => {
  it("reads the same number per API (004 is a bad token in a refund, not found in a query)", () => {
    expect(paytrErrorCode("status", "004")).toBe("payment_not_found")
    expect(paytrErrorCode("refund", "004")).toBe("token_invalid")
    expect(paytrErrorCode("status", "003")).toBe("token_invalid")
    expect(paytrErrorCode("refund", "009")).toBe("refund_exceeds_payment")
    expect(paytrErrorCode("refund", "006")).toBe("refund_exceeds_payment")
  })

  it("keeps an unknown number visible and a strange one out", () => {
    expect(paytrErrorCode("refund", "077")).toBe("error_077")
    expect(paytrErrorCode("refund", "<script>")).toBe("error")
    expect(paytrErrorCode("refund", undefined)).toBe("error")
  })

  it("marks only a locked refund service as worth retrying", () => {
    const locked = paytrError("refund", "000")
    const exceeded = paytrError("refund", "009")

    expect(locked).toBeInstanceOf(ProviderError)
    expect(locked).toMatchObject({
      provider: "paytr",
      providerCode: "refund_locked",
      retryable: true,
    })
    expect(exceeded.retryable).toBe(false)
  })

  it("keeps only the refused field's name from a token failure", () => {
    expect(tokenFailureCode("Zorunlu alan degeri gecersiz: merchant_id")).toBe(
      "token_refused_merchant_id"
    )
    expect(tokenFailureCode("Zorunlu alan degeri gecersiz veya gonderilmedi: email ayse@x")).toBe(
      "token_refused_email"
    )
    expect(tokenFailureCode("paytr_token gecersiz")).toBe("token_refused")
  })
})

import { MedusaError } from "@medusajs/framework/utils"
import { ProviderError, ValidationError } from "../../errors"
import { NEVER_LEFT, markRefused, refusedOutright } from "../refund-refusal"

const provider = (providerCode: string) =>
  new ProviderError({ provider: "paytr", providerCode, retryable: false })

describe("a refund refused outright, by an allow-list (security review 2026-11-17, O-1)", () => {
  it("is a refusal only when marked so where the call was made, or a check of ours", () => {
    expect(refusedOutright(markRefused(provider("payment_not_found")))).toBe(true)
    expect(refusedOutright(markRefused(provider("circuit_open")))).toBe(true)
    expect(refusedOutright(new ValidationError("paytr.balance_insufficient"))).toBe(true)
    // As it travels back from a workflow: a plain object, its marks kept
    const travelled: unknown = JSON.parse(JSON.stringify(markRefused(provider("error_002"))))
    expect(refusedOutright(travelled)).toBe(true)
    expect(refusedOutright({ qtErrorKind: "validation", safeMessage: "paytr.refund_locked" })).toBe(
      true
    )
  })

  it("is never a refusal when the answer may hide a refund", () => {
    for (const code of [
      "invalid_response",
      "signature_mismatch",
      "error_fault",
      "outcome_unknown",
      "http_502",
      "network_error",
    ]) {
      expect(refusedOutright(provider(code))).toBe(false)
    }
    expect(refusedOutright(new ValidationError("iyzico.refund_outcome_unknown"))).toBe(false)
    expect(refusedOutright(new MedusaError(MedusaError.Types.INVALID_DATA, "too much"))).toBe(false)
    expect(refusedOutright(new MedusaError(MedusaError.Types.NOT_FOUND, "no payment"))).toBe(false)
    expect(refusedOutright(new Error("socket hang up"))).toBe(false)
    expect(refusedOutright(undefined)).toBe(false)
    // A redirect refused is reported as `url_not_allowed` after the request went (D4-3)
    expect(NEVER_LEFT.has("url_not_allowed")).toBe(false)
    expect(NEVER_LEFT.has("circuit_open")).toBe(true)
  })
})

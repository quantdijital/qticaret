import { WorkflowResponse, createStep, createWorkflow } from "@medusajs/framework/workflows-sdk"
import {
  ProviderError,
  RetryableError,
  ValidationError,
  isProviderError,
  isRetryable,
  isRetryableError,
  isValidationError,
  toHttpError,
} from ".."

const providerError = (retryable: boolean) =>
  new ProviderError({
    provider: "acme-pay",
    code: "5001",
    retryable,
    cause: new Error("raw provider body with secret-token"),
  })

describe("error guards", () => {
  it("recognise each kind and nothing else", () => {
    const validation = new ValidationError("cart.invalid_quantity", { field: "quantity" })
    const provider = providerError(false)
    const retryable = new RetryableError()

    expect(isValidationError(validation)).toBe(true)
    expect(isProviderError(provider)).toBe(true)
    expect(isRetryableError(retryable)).toBe(true)

    for (const value of [validation, provider, retryable]) {
      const matches = [isValidationError, isProviderError, isRetryableError].filter((guard) =>
        guard(value)
      )
      expect(matches).toHaveLength(1)
    }
  })

  it("reject plain errors, Medusa errors and look-alikes with wrong field types", () => {
    for (const value of [
      new Error("boom"),
      { type: "invalid_data", message: "x" },
      { qtErrorKind: "provider", safeMessage: "k", message: "m", provider: "p", code: 1 },
      { qtErrorKind: "validation", safeMessage: 1, message: "m" },
      null,
      "validation",
    ]) {
      expect(isValidationError(value)).toBe(false)
      expect(isProviderError(value)).toBe(false)
      expect(isRetryableError(value)).toBe(false)
    }
  })

  it("treat only retryable provider failures and RetryableError as retryable", () => {
    expect(isRetryable(providerError(true))).toBe(true)
    expect(isRetryable(new RetryableError())).toBe(true)
    expect(isRetryable(providerError(false))).toBe(false)
    expect(isRetryable(new ValidationError("x.y"))).toBe(false)
  })

  it("keep the provider's code and cause out of the message shown to users", () => {
    const error = providerError(false)
    expect(error.message).toBe("acme-pay error 5001")
    expect(error.safeMessage).toBe("errors.provider_unavailable")
    expect(error.cause).toBeInstanceOf(Error)
  })
})

describe("toHttpError", () => {
  it.each([
    [
      "validation",
      new ValidationError("cart.invalid_quantity"),
      400,
      "invalid_data",
      "cart.invalid_quantity",
    ],
    ["provider", providerError(false), 502, "provider_error", "errors.provider_unavailable"],
    [
      "retryable provider",
      providerError(true),
      503,
      "provider_unavailable",
      "errors.provider_unavailable",
    ],
    [
      "retryable",
      new RetryableError(),
      503,
      "temporarily_unavailable",
      "errors.temporarily_unavailable",
    ],
  ])("maps a %s error to %i", (_kind, error, status, type, message) => {
    expect(toHttpError(error)).toEqual({ status, body: { type, message } })
  })

  it("rounds Retry-After up to whole seconds", () => {
    const error = new RetryableError("lock.busy", { retryAfterMs: 1200 })
    expect(toHttpError(error)?.retryAfterSeconds).toBe(2)
    expect(toHttpError(new RetryableError("x", { retryAfterMs: 0 }))?.retryAfterSeconds).toBe(1)
  })

  it("never puts the log message, provider, code or cause in the body", () => {
    const body = JSON.stringify(toHttpError(providerError(false))?.body)
    for (const leak of ["acme-pay", "5001", "secret-token", "raw provider body"]) {
      expect(body).not.toContain(leak)
    }
  })

  it("returns null for errors it does not own", () => {
    expect(toHttpError(new Error("boom"))).toBeNull()
    expect(toHttpError({ type: "not_found", message: "x" })).toBeNull()
  })
})

describe("errors thrown inside a workflow", () => {
  const failing = createStep("test-lib-errors-throw", (input: { retryable: boolean }) => {
    throw providerError(input.retryable)
  })
  const workflow = createWorkflow("test-lib-errors-workflow", (input: { retryable: boolean }) => {
    failing(input)
    return new WorkflowResponse(undefined)
  })

  it("lose their class but are still recognised and mapped", async () => {
    const caught: unknown = await workflow()
      .run({ input: { retryable: true } })
      .then(
        () => null,
        (error: unknown) => error
      )

    // The engine hands back a plain object, which is why the guards check shape
    expect(caught).not.toBeInstanceOf(ProviderError)
    expect(isProviderError(caught)).toBe(true)
    expect(isRetryable(caught)).toBe(true)
    expect(toHttpError(caught)).toEqual({
      status: 503,
      body: { type: "provider_unavailable", message: "errors.provider_unavailable" },
    })
  })
})

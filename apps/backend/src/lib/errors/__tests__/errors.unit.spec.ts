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
    providerCode: "5001",
    retryable,
    cause: new Error("raw provider body with secret-token"),
  })

const ERRORS = {
  validation: () => new ValidationError("cart.invalid_quantity", { field: "quantity" }),
  provider: () => providerError(true),
  retryable: () => new RetryableError("lock.busy", { retryAfterMs: 1200 }),
}
type Kind = keyof typeof ERRORS
const GUARDS = {
  validation: isValidationError,
  provider: isProviderError,
  retryable: isRetryableError,
}
const KINDS = Object.keys(ERRORS) as Kind[]

describe("error guards", () => {
  it.each(KINDS)("recognise a %s error and nothing else", (kind) => {
    const error = ERRORS[kind]()
    for (const other of KINDS) {
      expect(GUARDS[other](error)).toBe(other === kind)
    }
  })

  it.each(KINDS)("still recognise a %s error after a JSON round trip", (kind) => {
    // JSON drops `message` (not enumerable on Error), as a serialising engine would
    const copy: unknown = JSON.parse(JSON.stringify(ERRORS[kind]()))
    expect(GUARDS[kind](copy)).toBe(true)
    expect(toHttpError(copy)).toEqual(toHttpError(ERRORS[kind]()))
  })

  it("reject plain errors, Medusa errors and look-alikes with wrong field types", () => {
    for (const value of [
      new Error("boom"),
      { type: "invalid_data", message: "x" },
      {
        qtErrorKind: "provider",
        safeMessage: "k",
        provider: "p",
        providerCode: 1,
        retryable: true,
      },
      { qtErrorKind: "validation", safeMessage: 1 },
      { qtErrorKind: "retryable", safeMessage: "k", retryAfterMs: "soon" },
      null,
      "validation",
    ]) {
      for (const guard of Object.values(GUARDS)) {
        expect(guard(value)).toBe(false)
      }
    }
  })

  it("treat only retryable provider failures and RetryableError as retryable", () => {
    expect(isRetryable(providerError(true))).toBe(true)
    expect(isRetryable(new RetryableError())).toBe(true)
    expect(isRetryable(providerError(false))).toBe(false)
    expect(isRetryable(new ValidationError("x.y"))).toBe(false)
  })

  it("keep the provider's code out of `code`, which Medusa copies into responses", () => {
    const error = providerError(false)
    expect(error.message).toBe("acme-pay error 5001")
    expect(error.providerCode).toBe("5001")
    expect("code" in error).toBe(false)
    expect(error.cause).toBeInstanceOf(Error)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])("drop a retryAfterMs of %p", (delay) => {
    expect(new RetryableError("x.y", { retryAfterMs: delay }).retryAfterMs).toBeUndefined()
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
    expect(toHttpError(ERRORS.retryable())?.retryAfterSeconds).toBe(2)
    expect(toHttpError(new RetryableError("x.y", { retryAfterMs: 0 }))?.retryAfterSeconds).toBe(1)
  })

  it("never puts the log message, provider, code or cause in the body", () => {
    const body = JSON.stringify(toHttpError(providerError(false))?.body)
    for (const leak of ["acme-pay", "5001", "secret-token", "raw provider body"]) {
      expect(body).not.toContain(leak)
    }
  })

  it("replaces a safeMessage that is not an i18n key with the default key", () => {
    const leaky = [
      new ValidationError("SKU KNF-20 stokta yok"),
      new ProviderError({
        provider: "p",
        providerCode: "1",
        retryable: false,
        safeMessage: "Kart reddedildi: 4111",
      }),
      new RetryableError("lock busy on order_123"),
    ]
    expect(leaky.map((error) => toHttpError(error)?.body.message)).toEqual([
      "errors.invalid_data",
      "errors.provider_unavailable",
      "errors.temporarily_unavailable",
    ])
  })

  it("returns null for errors it does not own", () => {
    expect(toHttpError(new Error("boom"))).toBeNull()
    expect(toHttpError({ type: "not_found", message: "x" })).toBeNull()
  })
})

describe("errors thrown inside a workflow", () => {
  const failing = createStep("test-lib-errors-throw", (input: { kind: Kind }) => {
    throw ERRORS[input.kind]()
  })
  const workflow = createWorkflow("test-lib-errors-workflow", (input: { kind: Kind }) => {
    failing(input)
    return new WorkflowResponse(undefined)
  })

  it.each(KINDS)("lose their class but a %s error is still recognised and mapped", async (kind) => {
    const caught: unknown = await workflow()
      .run({ input: { kind } })
      .then(
        () => null,
        (error: unknown) => error
      )

    // The engine hands back a plain object, which is why the guards check shape
    expect(caught).not.toBeInstanceOf(Error)
    expect(GUARDS[kind](caught)).toBe(true)
    expect(toHttpError(caught)).toEqual(toHttpError(ERRORS[kind]()))
  })
})

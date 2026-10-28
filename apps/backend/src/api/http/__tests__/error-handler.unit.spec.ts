import { formatException } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { ProviderError, RetryableError, ValidationError } from "../../../lib/errors"
import { logger, runWithRequestContext } from "../../../lib/logging"
import { platformErrorHandler } from "../error-handler"
import { INTERNAL_ERROR_BODY, classifyDbMessage } from "../error-response"
import { fakeRequest, fakeResponse } from "./fakes"

const EMAIL = "ayse@example.com"

// Postgres errors as they reach Medusa's `formatException` unmapped
const UNIQUE = {
  code: "23505",
  table: "customer",
  detail: `Key (email, has_account)=(${EMAIL}, t) already exists.`,
}
const FOREIGN_KEY = {
  code: "23503",
  table: "cart",
  detail: 'Key (region_id)=(reg_123) is not present in table "region".',
}
const NOT_NULL = { code: "23502", table: "customer", column: "email" }

// What a module service throws for the same errors: Medusa's `dbErrorMapper`
// (utils/dal/mikro-orm/db-error-mapper, 2.21.2) is not exported, so its
// texts are copied here; integration-tests/http/error-responses.spec.ts
// checks the real one end to end.
const MAPPED = {
  duplicate: new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Customer with email: ${EMAIL}, has_account: true, already exists.`
  ),
  invalidReference: new MedusaError(
    MedusaError.Types.NOT_FOUND,
    "You tried to set relationship region_id: reg_123, but such entity does not exist"
  ),
  notNull: new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Cannot set field 'email' of Customer to null"
  ),
  unknownColumn: new MedusaError(MedusaError.Types.INVALID_DATA, 'column "x" does not exist'),
}

function handle(error: unknown, path = "/store/customers", requestId: unknown = "req-12345678") {
  const req = fakeRequest({ path, requestId })
  const response = fakeResponse()
  const next = jest.fn()
  platformErrorHandler(error, req, response.res, next)
  return { ...response, next, body: response.body() as Record<string, unknown> }
}

let info: jest.SpyInstance
let error: jest.SpyInstance

beforeEach(() => {
  info = jest.spyOn(logger, "info").mockImplementation(() => undefined)
  error = jest.spyOn(logger, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

const firstInfoFields = (): unknown => (info.mock.calls as unknown[][])[0]?.[0]

describe("classifyDbMessage", () => {
  it.each([
    [MAPPED.duplicate.message, "duplicate"],
    [MAPPED.invalidReference.message, "invalid_reference"],
    [MAPPED.notNull.message, "not_null"],
    [MAPPED.unknownColumn.message, "unknown_column"],
    [formatException(UNIQUE).message, "duplicate"],
    [formatException(FOREIGN_KEY).message, "invalid_reference"],
    [formatException(NOT_NULL).message, "not_null"],
  ])("classifies Medusa's text %p", (message, kind) => {
    expect(classifyDbMessage(message)).toBe(kind)
  })

  it.each([
    "Product with id: prod_1 was not found",
    "Cart id not found",
    "Unauthorized",
    "Invalid email",
    "errors.invalid_data",
  ])("leaves %p alone", (message) => {
    expect(classifyDbMessage(message)).toBeNull()
  })
})

describe("platformErrorHandler", () => {
  describe("platform errors", () => {
    it("maps a ValidationError to 400 with its key", () => {
      const { status, body } = handle(new ValidationError("billing_profile.tax_id_invalid"))

      expect(status()).toBe(400)
      expect(body).toEqual({
        type: "invalid_data",
        message: "billing_profile.tax_id_invalid",
        request_id: "req-12345678",
      })
    })

    it("gives a rule's key back from Medusa's body validation, and leaves longer text alone", () => {
      const keyed = handle(
        new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Invalid request: customer_segments.rules_empty"
        )
      )
      const prose = handle(
        new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Invalid request: Expected number, received string"
        )
      )

      expect(keyed.body).toMatchObject({ message: "customer_segments.rules_empty" })
      expect(prose.body).toMatchObject({
        message: "Invalid request: Expected number, received string",
      })
    })

    it("maps a ProviderError to 502 and logs it as a failure", () => {
      const providerError = new ProviderError({
        provider: "iyzico",
        providerCode: "5001",
        retryable: false,
      })

      const { status, body } = handle(providerError)

      expect(status()).toBe(502)
      expect(body).toMatchObject({ type: "provider_error" })
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "http.request_failed", status: 502, err: providerError }),
        "request failed"
      )
    })

    it("maps a RetryableError to 503 with Retry-After", () => {
      const { status, headers } = handle(new RetryableError(undefined, { retryAfterMs: 1500 }))

      expect(status()).toBe(503)
      expect(headers["retry-after"]).toBe("2")
    })
  })

  describe("database messages", () => {
    it("generalises a unique violation on the store API and logs only its kind", () => {
      const { status, body } = handle(MAPPED.duplicate)

      expect(status()).toBe(400)
      expect(body).toMatchObject({ type: "invalid_data", message: "errors.duplicate" })
      expect(JSON.stringify(body)).not.toMatch(/ayse|email|has_account/)
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "http.request_rejected", reason: "db_duplicate" }),
        "request rejected"
      )
      expect(JSON.stringify(info.mock.calls)).not.toContain(EMAIL)
    })

    it.each([
      [MAPPED.invalidReference, 404, "errors.invalid_reference"],
      [MAPPED.notNull, 400, "errors.invalid_data"],
      [MAPPED.unknownColumn, 400, "errors.invalid_data"],
      [FOREIGN_KEY, 404, "errors.invalid_reference"],
      [NOT_NULL, 400, "errors.invalid_data"],
    ])("generalises %p", (dbError, expectedStatus, message) => {
      const { status, body } = handle(dbError)

      expect(status()).toBe(expectedStatus)
      expect(body["message"]).toBe(message)
    })

    it("generalises a raw Postgres error on the auth API", () => {
      const { status, body } = handle(UNIQUE, "/auth/customer/emailpass/register")

      expect(status()).toBe(422)
      expect(body["message"]).toBe("errors.duplicate")
    })

    it("generalises under any other prefix", () => {
      const { body } = handle(MAPPED.duplicate, "/hooks/iyzico")

      expect(body["message"]).toBe("errors.duplicate")
    })

    it("keeps Medusa's message on the admin API but still logs only the kind", () => {
      const { status, body } = handle(MAPPED.duplicate, "/admin/customers")

      expect(status()).toBe(400)
      expect(body["message"]).toContain(EMAIL)
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "db_duplicate" }),
        "request rejected"
      )
    })
  })

  describe("other Medusa errors", () => {
    it("passes a not-found message through", () => {
      const notFound = new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Product with id: prod_1 was not found"
      )

      const { status, body } = handle(notFound)

      expect(status()).toBe(404)
      expect(body["message"]).toBe("Product with id: prod_1 was not found")
    })

    it.each([
      [
        "a database error",
        new MedusaError(MedusaError.Types.DB_ERROR, 'relation "secret_table" does not exist'),
      ],
      [
        "an unexpected state",
        new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "internal detail"),
      ],
      ["an unknown error", new Error("internal detail")],
    ])("hides %s behind the generic 500, admin included", (_label, failure) => {
      for (const path of ["/store/carts", "/admin/products"]) {
        const { status, body } = handle(failure, path)

        expect(status()).toBe(500)
        expect(body).toEqual({ ...INTERNAL_ERROR_BODY, request_id: "req-12345678" })
      }
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure }),
        "request failed"
      )
    })

    it("answers a stray ZodError with 400 and no schema paths", () => {
      const result = z.object({ email: z.string() }).safeParse({})

      const { status, body } = handle(result.error)

      expect(status()).toBe(400)
      expect(body).toMatchObject({ type: "invalid_data", message: "errors.invalid_data" })
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "zod_error" }),
        "request rejected"
      )
    })

    it("does not treat any object with an issues array as a ZodError", () => {
      const { status } = handle({ issues: [] })

      expect(status()).toBe(500)
    })
  })

  describe("body-parser errors", () => {
    // http-errors' shape; V8's JSON message quotes the body it failed on
    const parseFailure = Object.assign(
      new SyntaxError(`Unexpected token '}', "{"password":"hunter2",}" is not valid JSON`),
      {
        status: 400,
        statusCode: 400,
        expose: true,
        type: "entity.parse.failed",
        body: `{"password":"hunter2",}`,
      }
    )

    it("answers malformed JSON with a fixed 400 and logs only its type", () => {
      const { status, body } = handle(parseFailure, "/auth/customer/emailpass")

      expect(status()).toBe(400)
      expect(body).toEqual({
        type: "invalid_data",
        message: "errors.invalid_data",
        request_id: "req-12345678",
      })
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "http_entity.parse.failed" }),
        "request rejected"
      )
      expect(JSON.stringify([body, info.mock.calls])).not.toContain("hunter2")
    })

    it("answers an oversized body with 413", () => {
      const tooLarge = { status: 413, statusCode: 413, expose: true, type: "entity.too.large" }

      const { status, body } = handle(tooLarge)

      expect(status()).toBe(413)
      expect(body["message"]).toBe("errors.request_too_large")
    })
  })

  describe("request ID", () => {
    it("puts the same ID in the body and the header", () => {
      const { body, headers } = handle(new ValidationError("errors.invalid_data"))

      expect(body["request_id"]).toBe("req-12345678")
      expect(headers["x-request-id"]).toBe("req-12345678")
    })

    it("replaces an invalid incoming ID", () => {
      const { body, headers } = handle(
        new ValidationError("errors.invalid_data"),
        "/store/x",
        "bad id"
      )

      expect(body["request_id"]).not.toBe("bad id")
      expect(headers["x-request-id"]).toBe(body["request_id"])
    })
  })

  it("cuts off a response that has started, logging through the platform logger", () => {
    const req = fakeRequest()
    const response = fakeResponse(true)
    const next = jest.fn()
    const failure = new Error("late")

    platformErrorHandler(failure, req, response.res, next)

    expect(response.destroyed()).toBe(true)
    expect(response.body()).toBeUndefined()
    expect(next).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "http.response_failed", err: failure }),
      expect.any(String)
    )
  })

  it("answers the generic 500 when mapping the error fails", () => {
    // Medusa's formatException reads `table` and `detail` of a 23505 error
    const { status, body } = handle({ code: "23505" })

    expect(status()).toBe(500)
    expect(body).toEqual({ ...INTERNAL_ERROR_BODY, request_id: "req-12345678" })
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "http.error_handler_failed" }),
      expect.any(String)
    )
  })

  it("leaves request_id to the log context when the request has one", () => {
    runWithRequestContext({ requestId: "req-12345678" }, () => {
      handle(new ValidationError("errors.invalid_data"))
    })

    expect(firstInfoFields()).not.toHaveProperty("request_id")
  })

  it("writes request_id into the log line outside a request context", () => {
    handle(new ValidationError("errors.invalid_data"))

    expect(firstInfoFields()).toMatchObject({ request_id: "req-12345678" })
  })
})

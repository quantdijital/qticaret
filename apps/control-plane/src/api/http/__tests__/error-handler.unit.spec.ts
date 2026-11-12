import { MedusaError } from "@medusajs/framework/utils"
import { resolveCpError } from "../error-handler"

const EMAIL = "leyla.aksoy@sahafatolye.com.tr"

describe("resolveCpError (adr/0061 Ek C19 M1)", () => {
  it("keeps a refusal's key, its status and type", () => {
    const resolved = resolveCpError(
      new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.contacts_full")
    )
    expect(resolved).toEqual({
      status: 400,
      body: expect.objectContaining({
        type: "not_allowed",
        message: "cp.contacts_full",
      }) as unknown,
      code: "cp.contacts_full",
    })
  })

  it("logs the key Medusa's 409 text replaces", () => {
    const resolved = resolveCpError(
      new MedusaError(MedusaError.Types.CONFLICT, "cp.release_version_taken")
    )
    expect(resolved.status).toBe(409)
    expect(resolved.code).toBe("cp.release_version_taken")
  })

  it("never answers a duplicate's row values", () => {
    const resolved = resolveCpError(
      new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `TenantContact with email: ${EMAIL}, already exists.`
      )
    )
    expect(resolved).toEqual({
      status: 400,
      body: { type: "invalid_data", message: "errors.invalid_request" },
      code: "db_duplicate",
    })
  })

  it("answers a driver error with the fixed 500 and its SQLSTATE", () => {
    const cause = Object.assign(new Error("violates check constraint"), { code: "23514" })
    const error = Object.assign(
      new Error(`insert into "tenant_contact" ("email") values ('${EMAIL}')`),
      { cause }
    )
    const resolved = resolveCpError(error)
    expect(resolved.status).toBe(500)
    expect(resolved.body).toEqual({
      code: "unknown_error",
      type: "unknown_error",
      message: "An unknown error occurred.",
    })
    expect(resolved.code).toBe("23514")
    expect(JSON.stringify(resolved)).not.toContain(EMAIL)
  })

  it.each(["cp.tckn_unreadable", "cp.mfa_start_failed", "cp.invite_failed"])(
    "keeps the panel's 5xx key %s (Ek C19 takip LOW-1)",
    (key) => {
      const resolved = resolveCpError(new MedusaError(MedusaError.Types.UNEXPECTED_STATE, key))
      expect(resolved).toEqual({
        status: 500,
        body: { type: "unexpected_state", message: key },
        code: key,
      })
    }
  )

  it("keeps a provisioning key a plain error throws on a 5xx", () => {
    expect(resolveCpError(new Error("provisioning.no_port"))).toEqual({
      status: 500,
      body: { type: "unexpected_state", message: "provisioning.no_port" },
      code: "provisioning.no_port",
    })
  })

  it.each([
    "envelope.decrypt_failed",
    `cp.contact ${EMAIL}`,
    "cp.Upper_case",
    `cp.${"x".repeat(80)}`,
  ])("answers any other 5xx message %s with the fixed body", (message) => {
    const resolved = resolveCpError(new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message))
    expect(resolved.status).toBe(500)
    expect(resolved.body).toEqual({
      code: "unknown_error",
      type: "unknown_error",
      message: "An unknown error occurred.",
    })
    expect(JSON.stringify(resolved)).not.toContain(EMAIL)
  })

  it("answers body-parser's errors without their text", () => {
    const parse = Object.assign(new Error(`Unexpected token in JSON at "${EMAIL}"`), {
      status: 400,
      statusCode: 400,
      expose: true,
      type: "entity.parse.failed",
    })
    expect(resolveCpError(parse)).toEqual({
      status: 400,
      body: { type: "invalid_data", message: "errors.invalid_request" },
      code: "http_400",
    })
  })
})

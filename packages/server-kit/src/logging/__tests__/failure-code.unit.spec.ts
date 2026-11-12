import { classifyDbMessage } from "../../http/error-body"
import { codeSummary, failureCode, keyMessage, loggableCode } from "../failure-code"

const EMAIL = "selin@egezeytin.com.tr"

// Shaped like MikroORM's wrap of a pg error: the SQL with its bound values
// in the message, the driver's error (and its SQLSTATE) as `cause`
function driverError(code: string): Error {
  const cause = Object.assign(new Error(`new row violates check constraint`), { code })
  return Object.assign(
    new Error(`insert into "tenant_contact" ("email") values ('${EMAIL}') - ${cause.message}`),
    { name: "CheckConstraintViolationException", cause }
  )
}

describe("failureCode", () => {
  it("reads the error's own code, else its cause's, never the message", () => {
    expect(failureCode(Object.assign(new Error(EMAIL), { code: "23505" }))).toBe("23505")
    expect(failureCode(driverError("23514"))).toBe("23514")
    expect(failureCode(Object.assign(new Error("x"), { code: 57014 }))).toBe("57014")
  })

  it("is `unknown` for a missing or odd code", () => {
    expect(failureCode(new Error(EMAIL))).toBe("unknown")
    expect(failureCode(Object.assign(new Error("x"), { code: `a b ${EMAIL}` }))).toBe("unknown")
    expect(failureCode(null)).toBe("unknown")
    expect(failureCode("text")).toBe("unknown")
  })
})

describe("loggableCode", () => {
  it("keeps a stable key message and nothing else", () => {
    expect(keyMessage(new Error("cp.slug_taken"))).toBe("cp.slug_taken")
    expect(loggableCode(new Error("provisioning.no_port"))).toBe("provisioning.no_port")
    expect(keyMessage(new Error(`cp.contact ${EMAIL}`))).toBeNull()
    expect(keyMessage(new Error(EMAIL))).toBeNull()
    expect(loggableCode(driverError("23514"))).toBe("23514")
    expect(JSON.stringify(loggableCode(driverError("23514")))).not.toContain(EMAIL)
  })
})

describe("codeSummary", () => {
  it("gives the class name and the code, never the message", () => {
    expect(codeSummary(driverError("23514"))).toEqual({
      name: "CheckConstraintViolationException",
      code: "23514",
    })
    expect(codeSummary(Object.assign(new Error("x"), { name: `bad ${EMAIL}` }))).toEqual({
      code: "unknown",
    })
    expect(codeSummary("text")).toEqual({ code: "unknown" })
  })
})

describe("classifyDbMessage", () => {
  it("names Medusa's database texts and leaves the rest", () => {
    expect(classifyDbMessage(`TenantContact with email: ${EMAIL}, already exists.`)).toBe(
      "duplicate"
    )
    expect(classifyDbMessage("Cannot set field 'email' of TenantContact to null")).toBe("not_null")
    expect(classifyDbMessage("cp.slug_taken")).toBeNull()
    expect(classifyDbMessage(`x with y already exists.${"a".repeat(1100)}`)).toBeNull()
  })
})

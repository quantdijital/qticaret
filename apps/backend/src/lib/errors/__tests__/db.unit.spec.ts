import { MedusaError } from "@medusajs/framework/utils"
import { lockTimeoutError, uniqueViolationKeys } from "../db"

describe("uniqueViolationKeys", () => {
  it("reads the columns from Medusa's duplicate text", () => {
    const error = new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Url entry with locale: tr, path: /urun/sef-bicagi, already exists."
    )

    expect(uniqueViolationKeys(error)).toEqual(["locale", "path"])
  })

  it("reads a single-column index", () => {
    expect(uniqueViolationKeys(new Error("Customer with email: a@b.co, already exists."))).toEqual([
      "email",
    ])
  })

  it.each([
    new Error("connection reset"),
    new Error("Product with id: prod_1 was not found"),
    { message: 42 },
    null,
  ])("returns null for %p", (error) => {
    expect(uniqueViolationKeys(error)).toBeNull()
  })
})

describe("lockTimeoutError", () => {
  it("turns Medusa's lock timeout into a 503 without the key", () => {
    const error = lockTimeoutError(
      new Error('Failed to acquire lock for key "product-attributes:prod_1"')
    )

    expect(error).toMatchObject({ safeMessage: "errors.busy", retryAfterMs: 2000 })
    expect(JSON.stringify(error)).not.toContain("prod_1")
  })

  it("leaves other errors alone", () => {
    expect(lockTimeoutError(new Error("boom"))).toBeNull()
    expect(lockTimeoutError(null)).toBeNull()
  })
})

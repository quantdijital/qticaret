import { MedusaError } from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../db"

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

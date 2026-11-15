import { isConflictError } from "../../../lib/errors"
import { nameTaken } from "../steps/tier-rows"

describe("two levels of one name at once (L5)", () => {
  it("answers the unique index on the name as the name check does: 409 tier_exists", () => {
    const caught = (() => {
      try {
        nameTaken(new Error("Wholesale tier with name: Toptan A, already exists."))
      } catch (error) {
        return error
      }
      return null
    })()
    expect(isConflictError(caught)).toBe(true)
    expect((caught as { safeMessage?: string }).safeMessage).toBe("wholesale.tier_exists")
  })

  it("passes any other error on as it is", () => {
    const other = new Error("Wholesale tier with price_list_id: plist_1, already exists.")
    expect(() => nameTaken(other)).toThrow(other)
    expect(() => nameTaken(new Error("database down"))).toThrow("database down")
  })
})

import { leftBirfatura } from "../update-platform-settings"

describe("BirFatura's token goes when it is no longer the program (adr/0072 §3)", () => {
  it("is when the invoicing program moves from BirFatura to another, or to none", () => {
    expect(leftBirfatura("invoicing", { provider: "birfatura" }, { provider: "external" })).toBe(
      true
    )
    expect(leftBirfatura("invoicing", { provider: "birfatura" }, { provider: "none" })).toBe(true)
  })

  it("is not while BirFatura stays, when it is picked, or in another section", () => {
    expect(leftBirfatura("invoicing", { provider: "birfatura" }, { provider: "birfatura" })).toBe(
      false
    )
    expect(leftBirfatura("invoicing", { provider: "external" }, { provider: "birfatura" })).toBe(
      false
    )
    expect(leftBirfatura("invoicing", null, { provider: "external" })).toBe(false)
    expect(leftBirfatura("store", { provider: "birfatura" }, { provider: "external" })).toBe(false)
  })
})
